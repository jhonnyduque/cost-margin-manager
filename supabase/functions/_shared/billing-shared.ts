import Stripe from 'https://esm.sh/stripe@14.21.0';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const MANAGEABLE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
]);

const SUBSCRIPTION_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  incomplete: 4,
  incomplete_expired: 5,
  paused: 6,
  canceled: 7,
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface BillingAccessContext {
  requesterId: string;
  requesterEmail: string | null;
  isSuperAdmin: boolean;
  companyRole: string | null;
}

export interface BillingState {
  has_subscription: boolean;
  plan_key: string | null;
  status: string | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  portal_eligible: boolean;
  manageable_in_portal: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_exp_month: number | null;
  payment_method_exp_year: number | null;
}

interface CardSummary {
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_exp_month: number | null;
  payment_method_exp_year: number | null;
}

function compareSubscriptions(a: Stripe.Subscription, b: Stripe.Subscription) {
  const byStatus =
    (SUBSCRIPTION_STATUS_PRIORITY[a.status] ?? 99) -
    (SUBSCRIPTION_STATUS_PRIORITY[b.status] ?? 99);

  if (byStatus !== 0) {
    return byStatus;
  }

  return (b.current_period_end ?? 0) - (a.current_period_end ?? 0);
}

function emptyCardSummary(): CardSummary {
  return {
    payment_method_brand: null,
    payment_method_last4: null,
    payment_method_exp_month: null,
    payment_method_exp_year: null,
  };
}

function hasCardSummary(summary: CardSummary) {
  return Boolean(summary.payment_method_last4);
}

function toCardSummaryFromPaymentMethod(paymentMethod: Stripe.PaymentMethod | null): CardSummary {
  if (!paymentMethod || paymentMethod.type !== 'card' || !paymentMethod.card) {
    return emptyCardSummary();
  }

  return {
    payment_method_brand: paymentMethod.card.brand ?? null,
    payment_method_last4: paymentMethod.card.last4 ?? null,
    payment_method_exp_month: paymentMethod.card.exp_month ?? null,
    payment_method_exp_year: paymentMethod.card.exp_year ?? null,
  };
}

function toCardSummaryFromSource(source: Stripe.CustomerSource | null): CardSummary {
  if (!source || source.object !== 'card') {
    return emptyCardSummary();
  }

  return {
    payment_method_brand: source.brand?.toLowerCase() ?? null,
    payment_method_last4: source.last4 ?? null,
    payment_method_exp_month: source.exp_month ?? null,
    payment_method_exp_year: source.exp_year ?? null,
  };
}

function toCardSummaryFromCharge(charge: Stripe.Charge | null): CardSummary {
  const card = charge?.payment_method_details?.card;
  if (!card) {
    return emptyCardSummary();
  }

  return {
    payment_method_brand: card.brand ?? null,
    payment_method_last4: card.last4 ?? null,
    payment_method_exp_month: null,
    payment_method_exp_year: null,
  };
}

async function resolvePaymentMethodSummary(
  stripe: Stripe,
  paymentMethodId: string | null | undefined,
): Promise<CardSummary> {
  if (!paymentMethodId) {
    return emptyCardSummary();
  }

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    return toCardSummaryFromPaymentMethod(paymentMethod);
  } catch {
    return emptyCardSummary();
  }
}

async function resolveSourceSummary(
  stripe: Stripe,
  stripeCustomerId: string,
  sourceId: string | null | undefined,
): Promise<CardSummary> {
  if (!sourceId) {
    return emptyCardSummary();
  }

  try {
    const source = await stripe.customers.retrieveSource(stripeCustomerId, sourceId);
    return toCardSummaryFromSource(source as Stripe.CustomerSource);
  } catch {
    return emptyCardSummary();
  }
}

async function resolveInvoiceCardSummary(
  stripe: Stripe,
  stripeCustomerId: string,
): Promise<CardSummary> {
  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 1,
      expand: ['data.payment_intent.payment_method', 'data.charge'],
    });

    const invoice = invoices.data[0];
    if (!invoice) {
      return emptyCardSummary();
    }

    const paymentIntent = typeof invoice.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(invoice.payment_intent, { expand: ['payment_method'] })
      : invoice.payment_intent;

    const paymentIntentSummary = paymentIntent && typeof paymentIntent.payment_method !== 'string'
      ? toCardSummaryFromPaymentMethod(paymentIntent.payment_method)
      : await resolvePaymentMethodSummary(
          stripe,
          paymentIntent && typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : null,
        );

    if (hasCardSummary(paymentIntentSummary)) {
      return paymentIntentSummary;
    }

    const charge = typeof invoice.charge === 'string'
      ? await stripe.charges.retrieve(invoice.charge)
      : invoice.charge;

    return toCardSummaryFromCharge(charge ?? null);
  } catch {
    return emptyCardSummary();
  }
}

async function resolveCustomerCardSummary(
  stripe: Stripe,
  stripeCustomerId: string,
): Promise<CardSummary> {
  const customer = await stripe.customers.retrieve(stripeCustomerId, {
    expand: ['invoice_settings.default_payment_method', 'default_source'],
  });

  if (customer.deleted) {
    return emptyCardSummary();
  }

  const paymentMethod = customer.invoice_settings?.default_payment_method;
  const paymentMethodSummary = typeof paymentMethod === 'string'
    ? await resolvePaymentMethodSummary(stripe, paymentMethod)
    : toCardSummaryFromPaymentMethod(paymentMethod ?? null);

  if (hasCardSummary(paymentMethodSummary)) {
    return paymentMethodSummary;
  }

  const defaultSource = customer.default_source;
  const defaultSourceSummary = typeof defaultSource === 'string'
    ? await resolveSourceSummary(stripe, stripeCustomerId, defaultSource)
    : toCardSummaryFromSource(defaultSource ?? null);

  if (hasCardSummary(defaultSourceSummary)) {
    return defaultSourceSummary;
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: 'card',
    limit: 1,
  });

  const firstPaymentMethodSummary = toCardSummaryFromPaymentMethod(paymentMethods.data[0] ?? null);
  if (hasCardSummary(firstPaymentMethodSummary)) {
    return firstPaymentMethodSummary;
  }

  const cardSources = await stripe.customers.listSources(stripeCustomerId, {
    object: 'card',
    limit: 1,
  });

  const firstSourceSummary = toCardSummaryFromSource((cardSources.data[0] as Stripe.CustomerSource | undefined) ?? null);
  if (hasCardSummary(firstSourceSummary)) {
    return firstSourceSummary;
  }

  return resolveInvoiceCardSummary(stripe, stripeCustomerId);
}

export async function authenticateBillingRequester(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<BillingAccessContext> {
  if (!authHeader) {
    throw new HttpError(401, 'Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new HttpError(401, 'Token invalido o expirado');
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, is_super_admin')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    throw new HttpError(404, 'Usuario no encontrado');
  }

  return {
    requesterId: user.id,
    requesterEmail: userData.email ?? user.email ?? null,
    isSuperAdmin: userData.is_super_admin === true,
    companyRole: null,
  };
}

export async function authorizeBillingAccess(
  supabase: SupabaseClient,
  access: BillingAccessContext,
  companyId: string,
  allowedRoles?: string[],
): Promise<BillingAccessContext> {
  if (access.isSuperAdmin) {
    return access;
  }

  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', access.requesterId)
    .eq('is_active', true)
    .single();

  if (membershipError || !membership) {
    throw new HttpError(403, 'Acceso denegado para esta empresa');
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new HttpError(403, 'No autorizado para gestionar facturacion');
  }

  return {
    ...access,
    companyRole: membership.role,
  };
}

export function pickRelevantSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subscriptions.length === 0) {
    return null;
  }

  return [...subscriptions].sort(compareSubscriptions)[0];
}

export async function resolveStripeBillingState(
  stripe: Stripe,
  stripeCustomerId: string | null,
  fallbackPlanKey: string | null,
): Promise<BillingState> {
  if (!stripeCustomerId) {
    return {
      has_subscription: false,
      plan_key: fallbackPlanKey ?? 'demo',
      status: null,
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      stripe_price_id: null,
      portal_eligible: false,
      manageable_in_portal: false,
      ...emptyCardSummary(),
    };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 10,
    expand: ['data.items.data.price', 'data.default_payment_method'],
  });

  const sub = pickRelevantSubscription(subscriptions.data);
  if (!sub) {
    const customerCardSummary = await resolveCustomerCardSummary(stripe, stripeCustomerId);

    return {
      has_subscription: false,
      plan_key: fallbackPlanKey ?? 'demo',
      status: null,
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      stripe_price_id: null,
      portal_eligible: true,
      manageable_in_portal: false,
      ...customerCardSummary,
    };
  }

  const subscriptionPaymentMethod =
    typeof sub.default_payment_method === 'string'
      ? await resolvePaymentMethodSummary(stripe, sub.default_payment_method)
      : toCardSummaryFromPaymentMethod(sub.default_payment_method ?? null);
  const customerCardSummary = hasCardSummary(subscriptionPaymentMethod)
    ? emptyCardSummary()
    : await resolveCustomerCardSummary(stripe, stripeCustomerId);

  return {
    has_subscription: true,
    plan_key: sub.metadata?.plan_key ?? fallbackPlanKey,
    status: sub.status,
    current_period_end: sub.current_period_end ?? null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    stripe_subscription_id: sub.id,
    stripe_price_id: sub.items.data[0]?.price?.id ?? null,
    portal_eligible: true,
    manageable_in_portal: MANAGEABLE_SUBSCRIPTION_STATUSES.has(sub.status),
    ...(hasCardSummary(subscriptionPaymentMethod) ? subscriptionPaymentMethod : customerCardSummary),
  };
}
