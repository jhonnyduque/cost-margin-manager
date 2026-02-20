import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
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

        // 1. Get Requester Info
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const { data: { user: requester }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !requester) throw new Error('Invalid token')

        // 2. Parse Payload
        const payload = await req.json()
        const { action = 'create', company_id } = payload

        if (!company_id) {
            throw new Error('Missing company_id')
        }

        // 3. Authorization Check: Requester must be admin/owner of the target company
        const { data: membership, error: membError } = await supabaseClient
            .from('company_members')
            .select('role')
            .eq('company_id', company_id)
            .eq('user_id', requester.id)
            .single()

        const isPlatformAdmin = !!requester.app_metadata?.is_super_admin
        const isCompanyAdmin = ['admin', 'owner'].includes(membership?.role)

        if (!isPlatformAdmin && !isCompanyAdmin) {
            throw new Error('Access Denied: Insufficient permissions.')
        }

        // 4. Action Routing
        if (action === 'create') {
            const { email, role, password, full_name } = payload

            if (!email || !role || !password) {
                throw new Error('Missing required fields para creación.')
            }

            // Limit Check (Max 3 active users per company)
            const { count, error: countError } = await supabaseClient
                .from('company_members')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', company_id)
                .eq('is_active', true)

            if (countError) throw countError
            if (count && count >= 3) {
                throw new Error('User limit reached: Max 3 users per company allowed.')
            }

            console.log(`[TEAM] Creating user ${email} for company ${company_id}`)

            const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: full_name || email.split('@')[0] }
            })

            if (userError) throw userError

            const { error: insertError } = await supabaseClient
                .from('company_members')
                .insert({
                    company_id,
                    user_id: userData.user.id,
                    role: role,
                    is_active: true
                })

            if (insertError) {
                await supabaseClient.auth.admin.deleteUser(userData.user.id)
                throw insertError
            }

            return new Response(JSON.stringify({ success: true, status: 'created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'delete') {
            const { target_user_id } = payload
            if (!target_user_id) throw new Error('Missing target_user_id for deletion')

            console.log(`[TEAM] Deleting user ${target_user_id} from company ${company_id}`)

            // Remove membership
            const { error: delMemb } = await supabaseClient
                .from('company_members')
                .delete()
                .eq('user_id', target_user_id)
                .eq('company_id', company_id)

            if (delMemb) throw delMemb

            return new Response(JSON.stringify({ success: true, status: 'deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'update') {
            const { target_user_id, role, full_name, password } = payload
            if (!target_user_id) throw new Error('Missing target_user_id for update')

            console.log(`[TEAM] Updating user ${target_user_id} in company ${company_id}`)

            // 1. Update Membership Role (only if provided and different)
            if (role) {
                // Fetch current role to avoid redundant updates that trigger RLS/Triggers
                const { data: currentMemb } = await supabaseClient
                    .from('company_members')
                    .select('role')
                    .eq('user_id', target_user_id)
                    .eq('company_id', company_id)
                    .single()

                if (currentMemb && currentMemb.role !== role) {
                    console.log(`[TEAM] Changing role from ${currentMemb.role} to ${role}`)
                    const { error: roleErr } = await supabaseClient
                        .from('company_members')
                        .update({ role })
                        .eq('user_id', target_user_id)
                        .eq('company_id', company_id)
                    if (roleErr) throw roleErr
                }
            }

            // 2. Update Public Profile (public.users)
            if (full_name) {
                const { error: publicErr } = await supabaseClient
                    .from('users')
                    .update({ full_name })
                    .eq('id', target_user_id)
                if (publicErr) throw publicErr
            }

            // 3. Update Auth Metadata / Password
            const authUpdates: any = {}
            if (full_name) authUpdates.user_metadata = { full_name }
            if (password) authUpdates.password = password

            if (Object.keys(authUpdates).length > 0) {
                const { error: authErr } = await supabaseClient.auth.admin.updateUserById(
                    target_user_id,
                    authUpdates
                )
                if (authErr) throw authErr
            }

            return new Response(JSON.stringify({ success: true, status: 'updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'bulk_archive') {
            const { user_ids } = payload
            if (!user_ids || !Array.isArray(user_ids)) throw new Error('Missing user_ids array')

            console.log(`[TEAM] Archiving users: ${user_ids.join(', ')}`)

            const { error: archError } = await supabaseClient
                .from('company_members')
                .update({ is_active: false })
                .in('user_id', user_ids)
                .eq('company_id', company_id)

            if (archError) throw archError
            return new Response(JSON.stringify({ success: true, status: 'archived' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'bulk_delete') {
            const { user_ids } = payload
            if (!user_ids || !Array.isArray(user_ids)) throw new Error('Missing user_ids array')

            console.log(`[TEAM] Deleting multiple users: ${user_ids.join(', ')}`)

            const { error: delError } = await supabaseClient
                .from('company_members')
                .delete()
                .in('user_id', user_ids)
                .eq('company_id', company_id)

            if (delError) throw delError
            return new Response(JSON.stringify({ success: true, status: 'deleted_bulk' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        throw new Error(`Unsupported action: ${action}`)

    } catch (error: any) {
        console.error(`[TEAM ERROR] ${error.message}`)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
