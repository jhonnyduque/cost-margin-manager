import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import {
    HttpError,
    authenticateBillingRequester,
    authorizeBillingAccess,
    resolveStripeBillingState,
} from '../_shared/billing-shared.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

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

        const access = await authenticateBillingRequester(
            supabase,
            req.headers.get('Authorization')
        );

        const { price_id, company_id, plan_key } = await req.json();
        if (!price_id || !company_id || !plan_key) {
            throw new HttpError(400, 'Faltan campos requeridos: price_id, company_id, plan_key');
        }

        await authorizeBillingAccess(
            supabase,
            access,
            company_id,
            ['owner', 'admin', 'manager']
        );

        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id, name, slug, stripe_customer_id, subscription_tier')
            .eq('id', company_id)
            .single();

        if (companyError || !company) {
            throw new HttpError(404, 'Empresa no encontrada');
        }

        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            throw new HttpError(500, 'Stripe no esta configurado en el servidor');
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });

        let stripeCustomerId = company.stripe_customer_id;
        if (!stripeCustomerId) {
            console.log('[create-checkout-session] Creating Stripe customer', {
                company_id: company.id,
                actor_id: access.requesterId,
            });

            const customer = await stripe.customers.create({
                email: access.requesterEmail,
                name: company.name,
                metadata: {
                    company_id: company.id,
                    company_slug: company.slug || '',
                    supabase_user_id: access.requesterId,
                }
            });

            stripeCustomerId = customer.id;

            const { error: updateError } = await supabase
                .from('companies')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('id', company.id);

            if (updateError) {
                console.error('[create-checkout-session] Failed to save stripe_customer_id:', updateError);
            }
        }

        const billingState = await resolveStripeBillingState(
            stripe,
            stripeCustomerId,
            company.subscription_tier
        );

        const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
        if (billingState.manageable_in_portal) {
            if (billingState.stripe_price_id === price_id && ['active', 'trialing'].includes(billingState.status || '')) {
                return new Response(
                    JSON.stringify({
                        url: `${appUrl}/platform/billing?already_active=true`,
                        reason: 'already_active'
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const portalSession = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: `${appUrl}/platform/billing`,
            });

            return new Response(
                JSON.stringify({
                    url: portalSession.url,
                    portal: true,
                    reason: billingState.status,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[create-checkout-session] Creating checkout session', {
            company_id: company.id,
            actor_id: access.requesterId,
            plan_key,
        });

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: price_id,
                    quantity: 1,
                }
            ],
            mode: 'subscription',
            success_url: `${appUrl}/platform/billing?success=true`,
            cancel_url: `${appUrl}/platform/billing?canceled=true`,
            metadata: {
                company_id: company.id,
                plan_key,
                user_id: access.requesterId,
            },
            subscription_data: {
                metadata: {
                    company_id: company.id,
                    plan_key,
                }
            },
            allow_promotion_codes: true,
            automatic_tax: {
                enabled: true
            },
            customer_update: {
                address: 'auto',
                name: 'auto'
            }
        });

        if (!session.url) {
            throw new Error('Stripe no devolvio una URL de checkout');
        }

        return new Response(
            JSON.stringify({ url: session.url, session_id: session.id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('[create-checkout-session] CRITICAL ERROR:', error);
        const status = error instanceof HttpError ? error.status : 500;
        return new Response(
            JSON.stringify({ error: error.message || 'Error interno del servidor' }),
            {
                status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});

