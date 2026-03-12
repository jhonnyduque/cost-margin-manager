import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { pickRelevantSubscription } from '../_shared/billing-shared.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const unixToIso = (value: number | null | undefined): string | null => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }

    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const log = {
    info: (msg: string, meta?: Record<string, unknown>) => {
        console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() }));
    },
    warn: (msg: string, meta?: Record<string, unknown>) => {
        console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() }));
    },
    error: (msg: string, meta?: Record<string, unknown>) => {
        console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() }));
    },
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    let event: Stripe.Event | null = null;
    let eventRecordId: string | null = null;

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                }
            }
        );

        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

        if (!stripeSecretKey) {
            throw new Error('STRIPE_SECRET_KEY not configured');
        }

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET not configured');
        }

        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
        const signature = req.headers.get('stripe-signature');
        if (!signature) {
            throw new Error('Missing stripe-signature header');
        }

        const body = await req.text();
        try {
            event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (err: any) {
            log.error('Webhook signature verification failed', { error: err.message });
            return new Response(
                JSON.stringify({ error: `Webhook Error: ${err.message}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: insertedEvent, error: eventInsertError } = await supabase
            .from('subscription_events')
            .insert({
                stripe_event_id: event.id,
                event_type: event.type,
                payload: event,
                status: 'pending',
            })
            .select('id')
            .single();

        if (eventInsertError) {
            const duplicate = eventInsertError.code === '23505' || eventInsertError.message?.includes('duplicate key');
            if (duplicate) {
                log.info('Webhook event already processed', { event_id: event.id, event_type: event.type });
                return new Response(
                    JSON.stringify({ received: true, duplicate: true, event_id: event.id, event_type: event.type }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            throw eventInsertError;
        }

        eventRecordId = insertedEvent?.id ?? null;
        const eventType = event.type;
        const eventData = event.data.object as Stripe.Subscription | Stripe.Invoice | Stripe.Customer;

        const updateEventRecord = async (updates: Record<string, unknown>) => {
            if (!eventRecordId) {
                return;
            }

            const { error } = await supabase
                .from('subscription_events')
                .update(updates)
                .eq('id', eventRecordId);

            if (error) {
                log.error('Failed to update subscription_events row', { event_id: event?.id, error: error.message });
            }
        };

        const findCompanyByCustomerId = async (customerId: string) => {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name, slug, stripe_customer_id, subscription_tier, current_period_end, seat_limit')
                .eq('stripe_customer_id', customerId)
                .single();

            if (error || !data) {
                throw new Error(`Company not found for customer: ${customerId}`);
            }

            return data;
        };

        const updateCompanySubscription = async (
            customerId: string,
            updates: Record<string, unknown>
        ) => {
            const { error } = await supabase
                .from('companies')
                .update(updates)
                .eq('stripe_customer_id', customerId);

            if (error) {
                throw error;
            }
        };

        const getPlanSeatLimit = async (planSlug: string): Promise<number> => {
            const { data } = await supabase
                .from('subscription_plans')
                .select('max_users')
                .eq('slug', planSlug)
                .single();

            return data?.max_users || 5;
        };

        const resolveCompanyContext = async (customerId: string) => {
            const company = await findCompanyByCustomerId(customerId);
            await updateEventRecord({ company_id: company.id });
            return company;
        };

        log.info('Webhook event received', { event_id: event.id, event_type: eventType });

        switch (eventType) {
            case 'customer.subscription.created': {
                const subscription = eventData as Stripe.Subscription;
                const company = await resolveCompanyContext(subscription.customer as string);
                const planKey = subscription.metadata.plan_key || company.subscription_tier || 'starter';

                await updateCompanySubscription(subscription.customer as string, {
                    stripe_subscription_id: subscription.id,
                    subscription_status: subscription.status,
                    subscription_tier: planKey,
                    seat_limit: await getEffectiveSeatLimit(company, planKey),
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    current_period_end: unixToIso(subscription.current_period_end),
                    stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
                    grace_period_ends_at: null,
                    updated_at: new Date().toISOString()
                });

                log.info('Subscription created - company updated', {
                    event_id: event.id,
                    company_id: company.id,
                    customer_id: subscription.customer,
                    subscription_id: subscription.id,
                });
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = eventData as Stripe.Subscription;
                const company = await resolveCompanyContext(subscription.customer as string);
                const planKey = subscription.metadata.plan_key || company.subscription_tier || 'starter';

                await updateCompanySubscription(subscription.customer as string, {
                    stripe_subscription_id: subscription.id,
                    subscription_status: subscription.status,
                    subscription_tier: planKey,
                    seat_limit: await getEffectiveSeatLimit(company, planKey),
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    current_period_end: unixToIso(subscription.current_period_end),
                    stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
                    grace_period_ends_at: subscription.status === 'past_due'
                        ? unixToIso(subscription.current_period_end)
                        : null,
                    updated_at: new Date().toISOString()
                });

                log.info('Subscription updated - company updated', {
                    event_id: event.id,
                    company_id: company.id,
                    customer_id: subscription.customer,
                    subscription_id: subscription.id,
                    status: subscription.status,
                });
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = eventData as Stripe.Subscription;
                const customerId = subscription.customer as string;
                const company = await resolveCompanyContext(customerId);

                const remainingSubs = await stripe.subscriptions.list({
                    customer: customerId,
                    status: 'all',
                    limit: 10,
                    expand: ['data.items.data.price'],
                });
                const survivingSub = pickRelevantSubscription(
                    remainingSubs.data.filter((sub) => sub.id !== subscription.id && sub.status !== 'canceled')
                );

                if (survivingSub) {
                    const planKey = survivingSub.metadata.plan_key || company.subscription_tier || 'starter';
                    await updateCompanySubscription(customerId, {
                        stripe_subscription_id: survivingSub.id,
                        subscription_status: survivingSub.status,
                        subscription_tier: planKey,
                        seat_limit: await getEffectiveSeatLimit(company, planKey),
                        cancel_at_period_end: survivingSub.cancel_at_period_end,
                        current_period_end: unixToIso(survivingSub.current_period_end),
                        stripe_price_id: survivingSub.items.data[0]?.price?.id ?? null,
                        updated_at: new Date().toISOString()
                    });

                    log.info('Subscription deleted - surviving subscription applied', {
                        event_id: event.id,
                        company_id: company.id,
                        deleted_subscription_id: subscription.id,
                        surviving_subscription_id: survivingSub.id,
                    });
                } else {
                    await updateCompanySubscription(customerId, {
                        subscription_status: 'canceled',
                        stripe_subscription_id: null,
                        subscription_tier: 'demo',
                        cancel_at_period_end: false,
                        current_period_end: null,
                        stripe_price_id: null,
                        grace_period_ends_at: null,
                        updated_at: new Date().toISOString()
                    });

                    log.warn('Subscription deleted - company downgraded to demo', {
                        event_id: event.id,
                        company_id: company.id,
                        deleted_subscription_id: subscription.id,
                    });
                }
                break;
            }

            case 'customer.subscription.paused':
            case 'customer.subscription.resumed': {
                const subscription = eventData as Stripe.Subscription;
                const company = await resolveCompanyContext(subscription.customer as string);
                const status = eventType === 'customer.subscription.paused' ? 'past_due' : subscription.status;

                await updateCompanySubscription(subscription.customer as string, {
                    subscription_status: status,
                    updated_at: new Date().toISOString()
                });

                log.info('Subscription lifecycle event applied', {
                    event_id: event.id,
                    company_id: company.id,
                    customer_id: subscription.customer,
                    status,
                });
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = eventData as Stripe.Invoice;
                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string, {
                        expand: ['items.data.price'],
                    });
                    const company = await resolveCompanyContext(subscription.customer as string);
                    const planKey = subscription.metadata.plan_key || company.subscription_tier || 'starter';

                    await updateCompanySubscription(subscription.customer as string, {
                        stripe_subscription_id: subscription.id,
                        subscription_status: subscription.status,
                        subscription_tier: planKey,
                        seat_limit: await getEffectiveSeatLimit(company, planKey),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        current_period_end: unixToIso(subscription.current_period_end),
                        stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
                        grace_period_ends_at: null,
                        last_payment_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                    log.info('Invoice payment succeeded - company activated', {
                        event_id: event.id,
                        company_id: company.id,
                        subscription_id: subscription.id,
                    });
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = eventData as Stripe.Invoice;
                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string, {
                        expand: ['items.data.price'],
                    });
                    const company = await resolveCompanyContext(subscription.customer as string);
                    const periodEndIso = subscription.current_period_end
                        ? unixToIso(subscription.current_period_end)
                        : company.current_period_end;

                    await updateCompanySubscription(subscription.customer as string, {
                        subscription_status: 'past_due',
                        current_period_end: periodEndIso,
                        grace_period_ends_at: periodEndIso,
                        updated_at: new Date().toISOString()
                    });

                    log.warn('Invoice payment failed - company marked past_due', {
                        event_id: event.id,
                        company_id: company.id,
                        subscription_id: subscription.id,
                        grace_period_ends_at: periodEndIso,
                    });
                }
                break;
            }

            case 'invoice.payment_action_required': {
                const invoice = eventData as Stripe.Invoice;
                log.warn('Invoice payment action required', {
                    event_id: event.id,
                    invoice_id: invoice.id,
                    subscription_id: invoice.subscription,
                });
                break;
            }

            case 'customer.updated': {
                const customer = eventData as Stripe.Customer;
                const company = await resolveCompanyContext(customer.id);
                await supabase
                    .from('companies')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('stripe_customer_id', customer.id);

                log.info('Customer updated', {
                    event_id: event.id,
                    company_id: company.id,
                    customer_id: customer.id,
                });
                break;
            }

            case 'customer.deleted': {
                const customer = eventData as Stripe.Customer;
                const company = await resolveCompanyContext(customer.id);
                await supabase
                    .from('companies')
                    .update({
                        stripe_customer_id: null,
                        stripe_subscription_id: null,
                        stripe_price_id: null,
                        subscription_status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_customer_id', customer.id);

                log.warn('Customer deleted - company billing detached', {
                    event_id: event.id,
                    company_id: company.id,
                    customer_id: customer.id,
                });
                break;
            }

            case 'checkout.session.completed': {
                const session = eventData as Stripe.Checkout.Session;
                log.info('Checkout session completed', {
                    event_id: event.id,
                    customer_id: session.customer,
                    subscription_id: session.subscription,
                    company_id: session.metadata?.company_id,
                });
                break;
            }

            default:
                log.warn('Unhandled event type', { event_id: event.id, event_type: eventType });
        }

        await updateEventRecord({ status: 'processed', processed_at: new Date().toISOString() });

        return new Response(
            JSON.stringify({ received: true, event_type: eventType, event_id: event.id }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        log.error('Webhook processing error', {
            event_id: event?.id,
            error: error.message,
            stack: error.stack,
        });

        if (eventRecordId) {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
                { auth: { autoRefreshToken: false, persistSession: false } }
            );

            await supabase
                .from('subscription_events')
                .update({
                    status: 'failed',
                    error_message: error.message || 'Webhook processing failed',
                    processed_at: new Date().toISOString(),
                })
                .eq('id', eventRecordId);
        }

        return new Response(
            JSON.stringify({ error: error.message || 'Webhook processing failed' }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});


