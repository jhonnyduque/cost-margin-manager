import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    try {
        // 1. Inicializar Supabase con service role
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

        // 2. Autenticar usuario desde el Authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Token inválido o expirado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[create-checkout-session] User authenticated:', user.id);

        // 3. Parsear body
        const { price_id, company_id, plan_key } = await req.json();

        if (!price_id || !company_id || !plan_key) {
            return new Response(
                JSON.stringify({ error: 'Faltan campos requeridos: price_id, company_id, plan_key' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[create-checkout-session] Creating checkout for:', { company_id, plan_key, price_id });

        // 4. ✅ FIX SuperAdmin: verificar si es SuperAdmin antes de chequear membresía
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('is_super_admin, email')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            return new Response(
                JSON.stringify({ error: 'Usuario no encontrado' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const isSuperAdmin = userData.is_super_admin === true;
        console.log('[create-checkout-session] Is SuperAdmin:', isSuperAdmin);

        // 5. Verificar membresía solo si NO es SuperAdmin
        if (!isSuperAdmin) {
            const { data: membership, error: membershipError } = await supabase
                .from('company_members')
                .select('role')
                .eq('company_id', company_id)
                .eq('user_id', user.id)
                .single();

            if (membershipError || !membership) {
                return new Response(
                    JSON.stringify({ error: 'No autorizado: no eres miembro de esta empresa' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (!['admin', 'owner', 'manager'].includes(membership.role)) {
                return new Response(
                    JSON.stringify({ error: 'No autorizado: solo managers o admins pueden gestionar suscripciones' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            console.log('[create-checkout-session] Membership verified, role:', membership.role);
        }

        // 6. Obtener datos de la empresa
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id, name, slug, stripe_customer_id')
            .eq('id', company_id)
            .single();

        if (companyError || !company) {
            return new Response(
                JSON.stringify({ error: 'Empresa no encontrada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 7. Inicializar Stripe
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            console.error('[create-checkout-session] STRIPE_SECRET_KEY not configured');
            return new Response(
                JSON.stringify({ error: 'Stripe no está configurado en el servidor' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });

        // 8. Obtener o crear Stripe Customer
        let stripeCustomerId = company.stripe_customer_id;

        if (!stripeCustomerId) {
            console.log('[create-checkout-session] Creating new Stripe customer for company:', company.id);

            const customer = await stripe.customers.create({
                email: userData.email || user.email,
                name: company.name,
                metadata: {
                    company_id: company.id,
                    company_slug: company.slug || '',
                    supabase_user_id: user.id
                }
            });

            stripeCustomerId = customer.id;

            // Guardar stripe_customer_id en la empresa
            const { error: updateError } = await supabase
                .from('companies')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('id', company.id);

            if (updateError) {
                console.error('[create-checkout-session] Failed to save stripe_customer_id:', updateError);
            }

            console.log('[create-checkout-session] Stripe customer created:', stripeCustomerId);
        }

        // 9. URL base desde variable de entorno
        const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';

        // 10. Crear Stripe Checkout Session
        console.log('[create-checkout-session] Creating Stripe Checkout Session...');

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
                plan_key: plan_key,
                user_id: user.id
            },
            subscription_data: {
                metadata: {
                    company_id: company.id,
                    plan_key: plan_key
                }
            },
            allow_promotion_codes: true,
            automatic_tax: {
                enabled: true
            },
            // ✅ FIX: Permitir que Stripe coja la dirección y nombre del usuario durante checkout
            // Esto soluciona el error "customer_tax_location_invalid"
            customer_update: {
                address: 'auto',
                name: 'auto'
            }
        });

        if (!session.url) {
            throw new Error('Stripe no devolvió una URL de checkout');
        }

        console.log('[create-checkout-session] Session created:', session.id);

        return new Response(
            JSON.stringify({ url: session.url, session_id: session.id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('[create-checkout-session] CRITICAL ERROR:', error);

        const isAuthError = error.message?.toLowerCase().includes('unauthorized');

        return new Response(
            JSON.stringify({ error: error.message || 'Error interno del servidor' }),
            {
                status: isAuthError ? 401 : 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});