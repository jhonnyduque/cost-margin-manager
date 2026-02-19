import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

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
        const { company_name, company_slug, admin_email } = await req.json()

        if (!company_name || !company_slug || !admin_email) {
            throw new Error('Missing required fields: company_name, company_slug, admin_email')
        }

        console.log(`[BETO] Provisioning tenant: ${company_name} for ${admin_email}`)

        // 4. Crear Usuario en auth.users (Admin API)
        // Usamos una password temporal aleatoria. 
        // NOTA: En producción, se enviaría un email de reset o link mágico.
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

        const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
            email: admin_email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: `Admin ${company_name}` }
        })

        if (userError) {
            // Si el usuario ya existe, intentamos obtenerlo
            if (userError.message.includes('already registered')) {
                // Opcionalmente podrías buscar al usuario existente, 
                // pero por seguridad de plataforma fallamos si el email está ocupado 
                // para evitar "secuestro" de cuentas.
                throw new Error(`El email ${admin_email} ya está registrado en el sistema.`)
            }
            throw userError
        }

        const userId = userData.user.id

        // 5. Ejecutar Provisión en DB (RPC)
        const { data: rpcData, error: rpcError } = await supabaseClient.rpc('beto_provision_tenant', {
            p_company_name: company_name,
            p_company_slug: company_slug,
            p_user_id: userId,
            p_user_role: 'admin'
        })

        if (rpcError) throw rpcError

        // 6. Retornar Resultado (Sin credenciales)
        return new Response(
            JSON.stringify({
                success: true,
                company_id: rpcData.company_id,
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
