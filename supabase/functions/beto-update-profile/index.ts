import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        // Crear cliente de Supabase
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

        // Validar y extraer el token de autorización
        const authHeader = req.headers.get('Authorization')

        // Debug log
        console.log('[DEBUG] Authorization header presente:', !!authHeader)

        if (!authHeader) {
            console.warn('[AUTH ERROR] No se recibió el header Authorization')
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validar formato del token (case-insensitive)
        if (!authHeader.toLowerCase().startsWith('bearer ')) {
            console.warn('[AUTH ERROR] Formato inválido del Authorization header')
            return new Response(
                JSON.stringify({ error: 'Invalid Authorization header format. Expected: Bearer <token>' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Extraer token de forma segura
        const token = authHeader.slice(7).trim()

        if (!token) {
            console.warn('[AUTH ERROR] Token vacío después de "Bearer"')
            return new Response(
                JSON.stringify({ error: 'Empty token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('[DEBUG] Token extraído, longitud:', token.length)

        // Validar el token con Supabase
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError) {
            console.error('[AUTH ERROR] Error validando token:', {
                message: authError.message,
                status: authError.status,
                name: authError.name
            })
            return new Response(
                JSON.stringify({
                    error: 'Invalid or expired token',
                    details: authError.message
                }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!user) {
            console.warn('[AUTH ERROR] Token válido pero no se encontró el usuario')
            return new Response(
                JSON.stringify({ error: 'User not found' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`[SUCCESS] Usuario autenticado: ${user.id}`)

        // Parsear el body de la request
        const payload = await req.json()
        const { full_name, password } = payload

        console.log(`[PROFILE] Update requested for user: ${user.id}`)

        // Actualizar perfil en la tabla users (si existe)
        if (full_name) {
            const { error: profileErr } = await supabaseClient
                .from('users')
                .update({ full_name })
                .eq('id', user.id)

            if (profileErr) {
                console.error('[DB ERROR] Error actualizando tabla users:', profileErr)
                throw profileErr
            }
            console.log('[SUCCESS] Tabla users actualizada')
        }

        // Preparar actualizaciones de auth
        const authUpdates: any = {}
        if (full_name) authUpdates.user_metadata = { full_name }
        if (password) authUpdates.password = password

        // Actualizar auth metadata
        if (Object.keys(authUpdates).length > 0) {
            const { error: authUpdateErr } = await supabaseClient.auth.admin.updateUserById(
                user.id,
                authUpdates
            )
            if (authUpdateErr) {
                console.error('[AUTH ERROR] Error actualizando auth:', authUpdateErr)
                throw authUpdateErr
            }
            console.log('[SUCCESS] Auth actualizado')
        }

        console.log(`[COMPLETE] Perfil actualizado exitosamente para user: ${user.id}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Profile updated successfully'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error(`[PROFILE ERROR] ${error.message}`, {
            stack: error.stack,
            name: error.name
        })
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                type: error.name
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})