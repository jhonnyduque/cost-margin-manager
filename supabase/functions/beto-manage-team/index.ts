import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            {
                auth: { autoRefreshToken: false, persistSession: false }
            }
        )

        // 🔐 1. Validar token del requester
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requester }, error: authError } =
            await supabase.auth.getUser(token)

        if (authError || !requester) throw new Error('Invalid token')

        // 📦 2. Parse payload
        const payload = await req.json()
        const { action = 'create', company_id: payloadCompanyId } = payload

        // 🏢 3. Auto-detect company_id si no viene del frontend
        let company_id = payloadCompanyId

        if (!company_id) {
            const { data: membership } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('user_id', requester.id)
                .eq('is_active', true)
                .limit(1)
                .single()

            if (!membership) throw new Error('User has no active company')
            company_id = membership.company_id
        }

        // 🔎 4. Verificar permisos
        const { data: membership } = await supabase
            .from('company_members')
            .select('role')
            .eq('company_id', company_id)
            .eq('user_id', requester.id)
            .single()

        const isPlatformAdmin = !!requester.app_metadata?.is_super_admin
        const isCompanyAdmin = ['admin', 'owner'].includes(membership?.role)

        if (!isPlatformAdmin && !isCompanyAdmin) {
            throw new Error('Access Denied')
        }

        // 🔢 5. Obtener seat limit
        const { data: companyData } = await supabase
            .from('companies')
            .select('seat_limit')
            .eq('id', company_id)
            .single()

        const SEAT_LIMIT = companyData?.seat_limit ?? 3

        // ====================================================
        // ================== CREATE USER =====================
        // ====================================================
        if (action === 'create') {

            const { email, role, password, full_name } = payload
            if (!email || !role || !password) {
                throw new Error('Missing required fields')
            }

            // 🔢 Validar límite de usuarios
            const { count } = await supabase
                .from('company_members')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', company_id)
                .eq('is_active', true)

            if (count && count >= SEAT_LIMIT) {
                throw new Error(`Seat limit reached (${SEAT_LIMIT})`)
            }

            // 1️⃣ Crear usuario en auth
            const { data: userData, error: userError } =
                await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: {
                        full_name: full_name || email.split('@')[0]
                    }
                })

            if (userError) throw userError

            const userId = userData.user.id

            // 2️⃣ Crear perfil público
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    email,
                    full_name: full_name || email.split('@')[0]
                })

            if (profileError) {
                await supabase.auth.admin.deleteUser(userId)
                throw profileError
            }

            // 3️⃣ Insertar membership
            const { error: memberError } = await supabase
                .from('company_members')
                .insert({
                    company_id,
                    user_id: userId,
                    role,
                    is_active: true
                })

            if (memberError) {
                await supabase.from('users').delete().eq('id', userId)
                await supabase.auth.admin.deleteUser(userId)
                throw memberError
            }

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ====================================================
        // ================== UPDATE USER =====================
        // ====================================================
        if (action === 'update') {

            const { target_user_id, role, full_name, password } = payload
            if (!target_user_id) throw new Error('Missing target_user_id')

            // 🔁 Update role
            if (role) {
                await supabase
                    .from('company_members')
                    .update({ role })
                    .eq('user_id', target_user_id)
                    .eq('company_id', company_id)
            }

            // 🔁 Update profile
            if (full_name) {
                await supabase
                    .from('users')
                    .update({ full_name })
                    .eq('id', target_user_id)
            }

            // 🔁 Update auth
            const authUpdates: any = {}
            if (full_name) authUpdates.user_metadata = { full_name }
            if (password) authUpdates.password = password

            if (Object.keys(authUpdates).length > 0) {
                await supabase.auth.admin.updateUserById(
                    target_user_id,
                    authUpdates
                )
            }

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ====================================================
        // ================== DELETE USER =====================
        // ====================================================
        if (action === 'delete') {

            const { target_user_id } = payload
            if (!target_user_id) throw new Error('Missing target_user_id')

            await supabase
                .from('company_members')
                .delete()
                .eq('user_id', target_user_id)
                .eq('company_id', company_id)

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        throw new Error(`Unsupported action: ${action}`)

    } catch (error: any) {

        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})