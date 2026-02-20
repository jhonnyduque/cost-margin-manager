import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        // 2. Initialize Supabase Client with Service Role
        // Service Role is required to update auth.users (password/metadata) and bypass RLS if necessary
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

        // 3. Authenticate Requester
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized or invalid token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Parse Payload
        const payload = await req.json()
        const { full_name, password } = payload

        console.log(`[PROFILE] Update requested for user: ${user.id}`)

        // 5. Atomic Updates

        // A. Update public.users (Profile Table)
        if (full_name) {
            const { error: profileErr } = await supabaseClient
                .from('users')
                .update({ full_name })
                .eq('id', user.id)

            if (profileErr) throw profileErr
        }

        // B. Update auth.users (Auth Metadata & Password)
        const authUpdates: any = {}
        if (full_name) authUpdates.user_metadata = { full_name }
        if (password) authUpdates.password = password

        if (Object.keys(authUpdates).length > 0) {
            const { error: authUpdateErr } = await supabaseClient.auth.admin.updateUserById(
                user.id,
                authUpdates
            )
            if (authUpdateErr) throw authUpdateErr
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error(`[PROFILE ERROR] ${error.message}`)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
