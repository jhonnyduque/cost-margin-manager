import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ASSIGNABLE_ROLES = ['manager', 'operator', 'viewer'] as const

type AssignableRole = typeof ASSIGNABLE_ROLES[number]

const canInviteRole = (
    actorRole: string | null | undefined,
    roleToAssign: string,
    isPlatformAdmin: boolean,
) => {
    if (isPlatformAdmin) return ASSIGNABLE_ROLES.includes(roleToAssign as AssignableRole)
    if (actorRole === 'owner' || actorRole === 'admin') {
        return ASSIGNABLE_ROLES.includes(roleToAssign as AssignableRole)
    }
    if (actorRole === 'manager') {
        return roleToAssign === 'operator' || roleToAssign === 'viewer'
    }
    return false
}

const canManageTargetRole = (
    actorRole: string | null | undefined,
    targetRole: string | null | undefined,
    isPlatformAdmin: boolean,
) => {
    if (isPlatformAdmin) return true
    if (!actorRole || !targetRole) return false
    if (actorRole === 'owner') return ['admin', 'manager', 'operator', 'viewer'].includes(targetRole)
    if (actorRole === 'admin') return ['manager', 'operator', 'viewer'].includes(targetRole)
    if (actorRole === 'manager') return ['operator', 'viewer'].includes(targetRole)
    return false
}

const canDeleteTargetRole = (
    actorRole: string | null | undefined,
    targetRole: string | null | undefined,
    isPlatformAdmin: boolean,
) => {
    if (isPlatformAdmin) return true
    if (!actorRole || !targetRole) return false
    if (actorRole === 'owner') return ['admin', 'manager', 'operator', 'viewer'].includes(targetRole)
    if (actorRole === 'admin') return ['manager', 'operator', 'viewer'].includes(targetRole)
    return false
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

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const { data: { user: requester }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !requester) throw new Error('Invalid token')

        const payload = await req.json()
        const { action = 'create', company_id: payloadCompanyId } = payload

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

        const { data: membership } = await supabaseClient
            .from('company_members')
            .select('role')
            .eq('company_id', company_id)
            .eq('user_id', requester.id)
            .single()

        const { data: requesterRecord } = await supabaseClient
            .from('users')
            .select('is_super_admin')
            .eq('id', requester.id)
            .single()

        const requesterRole = membership?.role
        const isPlatformAdmin = requesterRecord?.is_super_admin === true
        const canCreateMembers = isPlatformAdmin || ['owner', 'admin', 'manager'].includes(requesterRole ?? '')
        const canUpdateMembers = isPlatformAdmin || ['owner', 'admin', 'manager'].includes(requesterRole ?? '')
        const canDeleteMembers = isPlatformAdmin || ['owner', 'admin'].includes(requesterRole ?? '')

        if (!isPlatformAdmin && !requesterRole) {
            throw new Error('Access Denied: Insufficient permissions.')
        }

        const { data: companyData, error: companyError } = await supabaseClient
            .from('companies')
            .select('subscription_tier, seat_limit')
            .eq('id', company_id)
            .single()

        let SEAT_LIMIT = 3
        if (companyError || !companyData) {
            console.warn('[TEAM] Could not fetch company billing context, using default 3')
        } else if (companyData.seat_limit && companyData.seat_limit > 0) {
            SEAT_LIMIT = companyData.seat_limit
        } else if (companyData.subscription_tier) {
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
        console.log(`[TEAM] Seat limit effective for company ${company_id}: ${SEAT_LIMIT} (tier: ${companyData?.subscription_tier})`)

        if (action === 'create') {
            const { email, role, password, full_name } = payload

            if (!email || !role || !password) {
                throw new Error('Missing required fields para creación.')
            }

            if (!canCreateMembers) {
                throw new Error('Access Denied: You cannot invite team members.')
            }

            if (!canInviteRole(requesterRole, role, isPlatformAdmin)) {
                throw new Error(`Access Denied: You cannot assign role "${role}".`)
            }

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

            const { data: existingUser } = await supabaseClient
                .from('users')
                .select('id, email, full_name')
                .eq('email', email)
                .single()

            let newUserId: string
            let userJustCreated = false

            if (existingUser) {
                console.log(`[TEAM] User with email ${email} already exists in users table, reusing ID: ${existingUser.id}`)
                newUserId = existingUser.id

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
                const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: full_name || email.split('@')[0] }
                })

                if (userError) throw userError

                newUserId = userData.user.id
                userJustCreated = true

                const nameToSave = full_name || email.split('@')[0]
                const { error: usersUpsertError } = await supabaseClient
                    .from('users')
                    .upsert({
                        id: newUserId,
                        email,
                        full_name: nameToSave
                    }, { onConflict: 'id' })

                if (usersUpsertError) {
                    console.error('[TEAM] Error upserting into users table:', usersUpsertError)
                    await supabaseClient
                        .from('users')
                        .update({ full_name: nameToSave })
                        .eq('id', newUserId)
                    console.log(`[TEAM] Fallback: updated full_name for user ${newUserId}`)
                }
            }

            const { data: existingMembership } = await supabaseClient
                .from('company_members')
                .select('id, role')
                .eq('user_id', newUserId)
                .eq('company_id', company_id)
                .single()

            if (existingMembership) {
                console.log(`[TEAM] Membership already exists for user ${newUserId} in company ${company_id}`)

                if (!canManageTargetRole(requesterRole, existingMembership.role, isPlatformAdmin)) {
                    throw new Error('Access Denied: You cannot modify this member.')
                }

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
                const { error: insertError } = await supabaseClient
                    .from('company_members')
                    .insert({
                        company_id,
                        user_id: newUserId,
                        role,
                        is_active: true
                    })

                if (insertError) {
                    if (userJustCreated) {
                        await supabaseClient.auth.admin.deleteUser(newUserId)
                    }
                    throw insertError
                }
            }

            console.log(`[TEAM] User ${email} processed successfully with name: ${full_name || email.split('@')[0]}`)

            return new Response(JSON.stringify({ success: true, status: 'created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'delete') {
            const { target_user_id } = payload
            if (!target_user_id) throw new Error('Missing target_user_id for deletion')

            if (!canDeleteMembers) {
                throw new Error('Access Denied: You cannot delete team members.')
            }

            const { data: targetMembership, error: targetMembershipError } = await supabaseClient
                .from('company_members')
                .select('role')
                .eq('user_id', target_user_id)
                .eq('company_id', company_id)
                .single()

            if (targetMembershipError || !targetMembership) {
                throw new Error('Target member not found.')
            }

            if (!canDeleteTargetRole(requesterRole, targetMembership.role, isPlatformAdmin)) {
                throw new Error('Access Denied: You cannot delete this member.')
            }

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

            if (!canUpdateMembers) {
                throw new Error('Access Denied: You cannot update team members.')
            }

            const { data: targetMembership, error: targetMembershipError } = await supabaseClient
                .from('company_members')
                .select('role')
                .eq('user_id', target_user_id)
                .eq('company_id', company_id)
                .single()

            if (targetMembershipError || !targetMembership) {
                throw new Error('Target member not found.')
            }

            if (!canManageTargetRole(requesterRole, targetMembership.role, isPlatformAdmin)) {
                throw new Error('Access Denied: You cannot update this member.')
            }

            console.log(`[TEAM] Updating user ${target_user_id} in company ${company_id}`)

            if (role) {
                if (!canInviteRole(requesterRole, role, isPlatformAdmin)) {
                    throw new Error(`Access Denied: You cannot assign role "${role}".`)
                }

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

            if (full_name) {
                const { error: publicErr } = await supabaseClient
                    .from('users')
                    .update({ full_name })
                    .eq('id', target_user_id)
                if (publicErr) throw publicErr
            }

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

            if (!canUpdateMembers) {
                throw new Error('Access Denied: You cannot archive team members.')
            }

            const { data: targetMemberships, error: targetMembershipsError } = await supabaseClient
                .from('company_members')
                .select('user_id, role')
                .in('user_id', user_ids)
                .eq('company_id', company_id)

            if (targetMembershipsError) throw targetMembershipsError

            const forbiddenTarget = (targetMemberships ?? []).find((member) =>
                !canManageTargetRole(requesterRole, member.role, isPlatformAdmin)
            )

            if (forbiddenTarget) {
                throw new Error('Access Denied: You cannot archive one or more selected members.')
            }

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

            if (!canDeleteMembers) {
                throw new Error('Access Denied: You cannot delete team members.')
            }

            const { data: targetMemberships, error: targetMembershipsError } = await supabaseClient
                .from('company_members')
                .select('user_id, role')
                .in('user_id', user_ids)
                .eq('company_id', company_id)

            if (targetMembershipsError) throw targetMembershipsError

            const forbiddenTarget = (targetMemberships ?? []).find((member) =>
                !canDeleteTargetRole(requesterRole, member.role, isPlatformAdmin)
            )

            if (forbiddenTarget) {
                throw new Error('Access Denied: You cannot delete one or more selected members.')
            }

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
