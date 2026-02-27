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

        // 2. Parse Payload + AUTO-DETECT company_id
        const payload = await req.json()
        const { action = 'create', company_id: payloadCompanyId } = payload

        // 🔧 AUTO-FIX: Si el frontend no manda company_id, lo sacamos del usuario logueado
        let company_id = payloadCompanyId
        if (!company_id) {
            const { data: membership, error: membError } = await supabaseClient
                .from('company_members')
                .select('company_id')
                .eq('user_id', requester.id)
                .eq('is_active', true)
                .limit(1)
                .single()

            if (membError || !membership) {
                throw new Error('User has no active company')
            }

            company_id = membership.company_id
            console.log(`[TEAM] company_id auto-detected from user: ${company_id}`)
        } else {
            console.log(`[TEAM] company_id received from payload: ${company_id}`)
        }

        // 3. Authorization Check
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

        // 🔧 FIX: Obtener max_users desde subscription_plans (dinámico por plan)
        const { data: companyData, error: companyError } = await supabaseClient
            .from('companies')
            .select('subscription_tier')
            .eq('id', company_id)
            .single()

        let SEAT_LIMIT = 3 // fallback seguro
        if (companyError || !companyData?.subscription_tier) {
            console.warn('[TEAM] Could not fetch subscription_tier, using default 3')
        } else {
            const { data: planData, error: planError } = await supabaseClient
                .from('subscription_plans')
                .select('max_users')
                .eq('slug', companyData.subscription_tier)
                .single()

            if (planError || !planData) {
                console.warn(`[TEAM] Could not fetch plan limits for tier ${companyData.subscription_tier}, using default 3`)
            } else {
                SEAT_LIMIT = planData.max_users
            }
        }
        console.log(`[TEAM] Seat limit for company ${company_id}: ${SEAT_LIMIT} (tier: ${companyData?.subscription_tier})`)

        // 4. Action Routing
        if (action === 'create') {
            const { email, role, password, full_name } = payload

            if (!email || !role || !password) {
                throw new Error('Missing required fields para creación.')
            }

            // 🔧 FIX: Usar SEAT_LIMIT dinámico
            const { count, error: countError } = await supabaseClient
                .from('company_members')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', company_id)
                .eq('is_active', true)

            if (countError) throw countError
            if (count && count >= SEAT_LIMIT) {
                throw new Error(`User limit reached: Max ${SEAT_LIMIT} users per company allowed.`)
            }

            console.log(`[TEAM] Creating user ${email} for company ${company_id}`)

            // ✅ FIX 1: Verificar si el email ya existe en la tabla users
            const { data: existingUser } = await supabaseClient
                .from('users')
                .select('id, email')
                .eq('email', email)
                .single()

            let newUserId: string
            let userJustCreated = false

            if (existingUser) {
                console.log(`[TEAM] User with email ${email} already exists in users table, reusing ID: ${existingUser.id}`)
                newUserId = existingUser.id

                // Actualizar el nombre si es necesario
                if (full_name && existingUser.full_name !== full_name) {
                    const { error: updateError } = await supabaseClient
                        .from('users')
                        .update({ full_name })
                        .eq('id', newUserId)

                    if (updateError) {
                        console.warn('[TEAM] Could not update existing user name:', updateError)
                    }
                }
            } else {
                // Crear usuario nuevo en auth
                const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: full_name || email.split('@')[0] }
                })

                if (userError) throw userError

                newUserId = userData.user.id
                userJustCreated = true

                // ✅ FIX 2: Upsert en la tabla users (el trigger handle_new_auth_user
                // puede crear el row antes, pero SIN full_name — el upsert lo corrige)
                const nameToSave = full_name || email.split('@')[0]
                const { error: usersUpsertError } = await supabaseClient
                    .from('users')
                    .upsert({
                        id: newUserId,
                        email: email,
                        full_name: nameToSave
                    }, { onConflict: 'id' })

                if (usersUpsertError) {
                    console.error('[TEAM] Error upserting into users table:', usersUpsertError)
                    // Fallback: intentar actualizar solo el nombre
                    await supabaseClient
                        .from('users')
                        .update({ full_name: nameToSave })
                        .eq('id', newUserId)
                    console.log(`[TEAM] Fallback: updated full_name for user ${newUserId}`)
                }
            }

            // ✅ FIX 3: Verificar si ya existe la membership antes de insertar
            const { data: existingMembership } = await supabaseClient
                .from('company_members')
                .select('id')
                .eq('user_id', newUserId)
                .eq('company_id', company_id)
                .single()

            if (existingMembership) {
                console.log(`[TEAM] Membership already exists for user ${newUserId} in company ${company_id}`)

                // Actualizar el role si es diferente
                if (role && existingMembership.role !== role) {
                    const { error: updateError } = await supabaseClient
                        .from('company_members')
                        .update({ role, is_active: true })
                        .eq('user_id', newUserId)
                        .eq('company_id', company_id)

                    if (updateError) {
                        console.warn('[TEAM] Could not update existing membership:', updateError)
                    }
                }
            } else {
                // Insertar en company_members
                const { error: insertError } = await supabaseClient
                    .from('company_members')
                    .insert({
                        company_id,
                        user_id: newUserId,
                        role: role,
                        is_active: true
                    })

                if (insertError) {
                    // Solo eliminar el usuario auth si lo acabamos de crear
                    if (userJustCreated) {
                        await supabaseClient.auth.admin.deleteUser(newUserId)
                    }
                    throw insertError
                }
            }

            console.log(`[TEAM] User ${email} processed successfully with name: ${full_name || email.split('@')[0]}`)

            return new Response(JSON.stringify({ success: true, status: 'created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ... (el resto de las acciones delete, update, bulk se mantienen igual)
        if (action === 'delete') {
            const { target_user_id } = payload
            if (!target_user_id) throw new Error('Missing target_user_id for deletion')

            console.log(`[TEAM] Deleting user ${target_user_id} from company ${company_id}`)

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

            // 1. Update Membership Role
            if (role) {
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

            // 2. Update Public Profile
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
