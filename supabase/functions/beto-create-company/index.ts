import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import Stripe from 'https://esm.sh/stripe@14.14.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Manejar CORS (Preflight)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        )

        // 2. Verificar Autorización (JWT del Super Admin)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !user) {
            throw new Error('Invalid token')
        }

        // El check de is_super_admin debe estar en app_metadata
        if (!user.app_metadata?.is_super_admin) {
            throw new Error('Access Denied: Only platform admins can perform this action')
        }

        // 3. Procesar Payload
        const { company_name, company_slug, admin_email, seat_limit, initial_plan } = await req.json()

        if (!company_name || !company_slug || !admin_email) {
            throw new Error('Missing required fields: company_name, company_slug, admin_email')
        }

        console.log(`[BETO] Provisioning tenant: ${company_name} for ${admin_email}, Seats: ${seat_limit}, Plan: ${initial_plan}`)

        // 3.1. Crear Stripe Customer (Billing Authority)
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        let stripeCustomerId = null;

        if (stripeKey) {
            try {
                const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' }); // Use appropriate version
                const customer = await stripe.customers.create({
                    email: admin_email,
                    name: company_name,
                    metadata: {
                        company_slug: company_slug,
                        platform: 'BETO OS',
                        initial_plan: initial_plan || 'demo'
                    }
                });
                stripeCustomerId = customer.id;
                console.log(`[BETO] Created Stripe Customer: ${stripeCustomerId}`);
            } catch (stripeError) {
                console.error('[BETO] Stripe Creation Error:', stripeError);
                // We proceed but log error. Ideally we might want to fail here depending on strictness.
                // For now, we allow proceeding to allow manual repair if Stripe is down.
            }
        } else {
            console.warn('[BETO] STRIPE_SECRET_KEY not set. Skipping Stripe Customer creation.');
        }

        // 4. Crear Usuario en auth.users (Admin API)
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

        const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
            email: admin_email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: `Admin ${company_name}` }
        })

        // ... (User creation error handling) ...

        const userId = userData?.user?.id || 'error'; // Safety check though logic above throws

        if (userError) {
            if (userError.message.includes('already registered')) {
                throw new Error(`El email ${admin_email} ya está registrado en el sistema.`)
            }
            throw userError
        }

        // 5. Ejecutar Provisión en DB (RPC)
        const { data: rpcData, error: rpcError } = await supabaseClient.rpc('beto_provision_tenant', {
            p_company_name: company_name,
            p_company_slug: company_slug,
            p_user_id: userId,
            p_user_role: 'admin'
        })

        if (rpcError) throw rpcError

        const companyId = rpcData.company_id;

        // 5.1. Update Company with Stripe ID AND Initial details (Seat Limit, Plan)
        if (companyId) {
            const updates: any = {};
            if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
            if (seat_limit) updates.seat_limit = seat_limit;
            if (initial_plan) updates.subscription_tier = initial_plan; // Legacy tier setting for initial state

            const { error: updateError } = await supabaseClient
                .from('companies')
                .update(updates)
                .eq('id', companyId);

            if (updateError) {
                console.error('[BETO] Failed to update Company details:', updateError);
            }
        }

        // 6. Retornar Resultado (Sin credenciales)
        return new Response(
            JSON.stringify({
                success: true,
                company_id: companyId,
                stripe_customer_id: stripeCustomerId,
                admin_email: admin_email,
                status: 'provisioned'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error(`[BETO ERROR] ${error.message}`)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
