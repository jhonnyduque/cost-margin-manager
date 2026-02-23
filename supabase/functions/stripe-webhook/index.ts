import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// 🔧 Logging estructurado
const log = {
    info: (msg: string, meta?: Record<string, any>) => {
        console.log(JSON.stringify({
            level: 'info',
            msg,
            ...meta,
            ts: new Date().toISOString()
        }));
    },
    error: (msg: string, meta?: Record<string, any>) => {
        console.error(JSON.stringify({
            level: 'error',
            msg,
            ...meta,
            ts: new Date().toISOString()
        }));
    },
    warn: (msg: string, meta?: Record<string, any>) => {
        console.warn(JSON.stringify({
            level: 'warn',
            msg,
            ...meta,
            ts: new Date().toISOString()
        }));
    }
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    try {
        // 1. Initialize Supabase with service role
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

        // 2. Initialize Stripe
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

        if (!stripeSecretKey) {
            throw new Error('STRIPE_SECRET_KEY not configured');
        }

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET not configured');
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });

        // 3. Get the signature from headers
        const signature = req.headers.get('stripe-signature');
        if (!signature) {
            throw new Error('Missing stripe-signature header');
        }

        // 4. Verify webhook signature
        let event: Stripe.Event;

        try {
            const body = await req.text();
            event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (err: any) {
            log.error('Webhook signature verification failed', {
                error: err.message
            });
            return new Response(
                JSON.stringify({ error: `Webhook Error: ${err.message}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        log.info('Webhook event received', {
            type: event.type,
            id: event.id
        });

        // 5. Handle the event
        const eventType = event.type;
        const eventData = event.data.object as Stripe.Subscription | Stripe.Invoice | Stripe.Customer;

        // ✅ FIX: Helper actualizado para buscar por stripe_customer_id (no por subscription_id)
        const updateCompanySubscription = async (
            customerId: string,
            updates: Record<string, any>
        ) => {
            const { error } = await supabase
                .from('companies')
                .update(updates)
                .eq('stripe_customer_id', customerId);

            if (error) {
                throw error;
            }
        };

        // Helper to find company by Stripe customer ID
        const findCompanyByCustomerId = async (customerId: string) => {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name, slug')
                .eq('stripe_customer_id', customerId)
                .single();

            if (error || !data) {
                throw new Error(`Company not found for customer: ${customerId}`);
            }

            return data;
        };

        // 🔔 Event Handlers
        switch (eventType) {

            // ██████████████████████████████████████████████████████████
            // SUBSCRIPTION EVENTS
            // ██████████████████████████████████████████████████████████

            case 'customer.subscription.created': {
                const subscription = eventData as Stripe.Subscription;

                log.info('Subscription created', {
                    subscription_id: subscription.id,
                    customer_id: subscription.customer,
                    status: subscription.status,
                    plan: subscription.items.data[0]?.plan.id
                });

                const company = await findCompanyByCustomerId(
                    subscription.customer as string
                );

                // ✅ FIX: Pasar customer ID, no subscription ID
                await updateCompanySubscription(subscription.customer as string, {
                    stripe_subscription_id: subscription.id,
                    subscription_status: subscription.status,
                    subscription_tier: subscription.metadata.plan_key || 'starter',
                    updated_at: new Date().toISOString()
                });

                log.info('Subscription created - Company updated', {
                    company_id: company.id,
                    company_name: company.name
                });

                break;
            }

            case 'customer.subscription.updated': {
                const subscription = eventData as Stripe.Subscription;

                log.info('Subscription updated', {
                    subscription_id: subscription.id,
                    status: subscription.status,
                    current_period_end: subscription.current_period_end
                });

                const company = await findCompanyByCustomerId(
                    subscription.customer as string
                );

                // ✅ FIX: Pasar customer ID, no subscription ID + fallback seguro
                await updateCompanySubscription(subscription.customer as string, {
                    subscription_status: subscription.status,
                    subscription_tier: subscription.metadata.plan_key || 'starter',
                    updated_at: new Date().toISOString()
                });

                log.info('Subscription updated - Company updated', {
                    company_id: company.id
                });

                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = eventData as Stripe.Subscription;

                log.warn('Subscription deleted', {
                    subscription_id: subscription.id,
                    customer_id: subscription.customer
                });

                const company = await findCompanyByCustomerId(
                    subscription.customer as string
                );

                // ✅ FIX: Pasar customer ID, no subscription ID
                await updateCompanySubscription(subscription.customer as string, {
                    subscription_status: 'canceled',
                    stripe_subscription_id: null,
                    subscription_tier: 'demo',
                    updated_at: new Date().toISOString()
                });

                log.error('Subscription deleted - Company downgraded to demo', {
                    company_id: company.id,
                    company_name: company.name
                });

                break;
            }

            case 'customer.subscription.paused': {
                const subscription = eventData as Stripe.Subscription;

                log.warn('Subscription paused', {
                    subscription_id: subscription.id,
                    customer_id: subscription.customer
                });

                // ✅ FIX: Pasar customer ID, no subscription ID
                await updateCompanySubscription(subscription.customer as string, {
                    subscription_status: 'past_due',
                    updated_at: new Date().toISOString()
                });

                break;
            }

            case 'customer.subscription.resumed': {
                const subscription = eventData as Stripe.Subscription;

                log.info('Subscription resumed', {
                    subscription_id: subscription.id,
                    customer_id: subscription.customer
                });

                // ✅ FIX: Pasar customer ID, no subscription ID
                await updateCompanySubscription(subscription.customer as string, {
                    subscription_status: 'active',
                    updated_at: new Date().toISOString()
                });

                break;
            }

            // ██████████████████████████████████████████████████████████
            // INVOICE EVENTS
            // ██████████████████████████████████████████████████████████

            case 'invoice.payment_succeeded': {
                const invoice = eventData as Stripe.Invoice;

                log.info('Invoice payment succeeded', {
                    invoice_id: invoice.id,
                    subscription_id: invoice.subscription,
                    amount_paid: invoice.amount_paid,
                    currency: invoice.currency
                });

                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(
                        invoice.subscription as string
                    );

                    const company = await findCompanyByCustomerId(
                        subscription.customer as string
                    );

                    // ✅ FIX: Pasar customer ID, no subscription ID
                    await updateCompanySubscription(subscription.customer as string, {
                        subscription_status: 'active',
                        last_payment_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                    log.info('Invoice payment succeeded - Subscription active', {
                        company_id: company.id
                    });
                }

                break;
            }

            case 'invoice.payment_failed': {
                const invoice = eventData as Stripe.Invoice;

                log.error('Invoice payment failed', {
                    invoice_id: invoice.id,
                    subscription_id: invoice.subscription,
                    amount_due: invoice.amount_due,
                    next_payment_attempt: invoice.next_payment_attempt
                });

                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(
                        invoice.subscription as string
                    );

                    const company = await findCompanyByCustomerId(
                        subscription.customer as string
                    );

                    const gracePeriodEnds = new Date();
                    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 7);

                    // ✅ FIX: Pasar customer ID, no subscription ID
                    await updateCompanySubscription(subscription.customer as string, {
                        subscription_status: 'past_due',
                        grace_period_ends_at: gracePeriodEnds.toISOString(),
                        updated_at: new Date().toISOString()
                    });

                    log.warn('Invoice payment failed - Grace period started', {
                        company_id: company.id,
                        grace_period_ends: gracePeriodEnds.toISOString()
                    });
                }

                break;
            }

            case 'invoice.payment_action_required': {
                const invoice = eventData as Stripe.Invoice;

                log.warn('Invoice payment action required', {
                    invoice_id: invoice.id,
                    subscription_id: invoice.subscription,
                    hosted_invoice_url: invoice.hosted_invoice_url
                });

                break;
            }

            // ██████████████████████████████████████████████████████████
            // CUSTOMER EVENTS
            // ██████████████████████████████████████████████████████████

            case 'customer.updated': {
                const customer = eventData as Stripe.Customer;

                log.info('Customer updated', {
                    customer_id: customer.id,
                    email: customer.email
                });

                await supabase
                    .from('companies')
                    .update({
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_customer_id', customer.id);

                break;
            }

            case 'customer.deleted': {
                const customer = eventData as Stripe.Customer;

                log.warn('Customer deleted', {
                    customer_id: customer.id
                });

                await supabase
                    .from('companies')
                    .update({
                        stripe_customer_id: null,
                        stripe_subscription_id: null,
                        subscription_status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_customer_id', customer.id);

                break;
            }

            // ██████████████████████████████████████████████████████████
            // CHECKOUT SESSION EVENTS
            // ██████████████████████████████████████████████████████████

            case 'checkout.session.completed': {
                const session = eventData as Stripe.Checkout.Session;

                log.info('Checkout session completed', {
                    session_id: session.id,
                    customer_id: session.customer,
                    subscription_id: session.subscription,
                    mode: session.mode
                });

                break;
            }

            // ██████████████████████████████████████████████████████████
            // DEFAULT CASE
            // ██████████████████████████████████████████████████████████

            default:
                log.warn(`Unhandled event type: ${eventType}`);
        }

        // 6. Return success response
        return new Response(
            JSON.stringify({
                received: true,
                event_type: eventType,
                event_id: event.id
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        log.error('Webhook processing error', {
            error: error.message,
            stack: error.stack
        });

        return new Response(
            JSON.stringify({
                error: error.message || 'Webhook processing failed'
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});