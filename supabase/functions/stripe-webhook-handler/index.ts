import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import Stripe from 'https://esm.sh/stripe@14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
        return new Response('Missing signature or secret', { status: 400 });
    }

    try {
        const body = await req.text();
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            cryptoProvider
        );

        console.log(`[Webhook] Event: ${event.type} (${event.id})`);

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // --- Event Handling --- //

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await handleSubscriptionChange(supabase, subscription, event.type === 'customer.subscription.deleted');
                break;
            }
            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    // Update period end or status logic can be here, 
                    // but usually handled by subscription.updated
                    // We might just log for now or updating specific failure states.
                    console.log(`[Webhook] Invoice ${invoice.id} status: ${invoice.status}`);
                }
                break;
            }
            default:
                console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err: any) {
        console.error(`[Webhook Error] ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
});

async function handleSubscriptionChange(supabase: any, sub: any, isDeleted: boolean) {
    const customerId = sub.customer as string;
    const status = isDeleted ? 'canceled' : sub.status;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();

    console.log(`[Webhook] Syncing Customer ${customerId}: Status=${status}, Price=${priceId}`);

    // Update Company
    const { error } = await supabase
        .from('companies')
        .update({
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            subscription_status: status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', customerId);

    if (error) {
        console.error('[Webhook] DB Update Failed:', error);
        throw error;
    }
}
