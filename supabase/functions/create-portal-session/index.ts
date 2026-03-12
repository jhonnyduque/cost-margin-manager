import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import {
    HttpError,
    authenticateBillingRequester,
    authorizeBillingAccess,
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
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const access = await authenticateBillingRequester(
            supabase,
            req.headers.get('Authorization')
        );

        const { company_id } = await req.json();
        if (!company_id) {
            throw new HttpError(400, 'Falta company_id');
        }

        await authorizeBillingAccess(
            supabase,
            access,
            company_id,
            ['owner', 'admin', 'manager']
        );

        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id, stripe_customer_id')
            .eq('id', company_id)
            .single();

        if (companyError || !company) {
            throw new HttpError(404, 'Empresa no encontrada');
        }

        if (!company.stripe_customer_id) {
            throw new HttpError(400, 'Esta empresa no tiene un customer de Stripe configurado.');
        }

        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            throw new HttpError(500, 'Stripe no configurado');
        }

        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
        const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: company.stripe_customer_id,
            return_url: `${appUrl}/platform/billing`,
        });

        return new Response(
            JSON.stringify({ url: portalSession.url }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('[create-portal-session] ERROR:', error);
        const status = error instanceof HttpError ? error.status : 500;
        return new Response(
            JSON.stringify({ error: error.message || 'Error interno' }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

