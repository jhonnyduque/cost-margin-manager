import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0";

// ============================================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================================

const REQUIRED_ENV_VARS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APP_URL"] as const;

const VALIDATION_RULES = {
    SLUG_REGEX: /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    NAME_REGEX: /^.{2,100}$/u,
    VALID_PLANS: ["demo", "starter", "growth", "scale", "enterprise"],
    VALID_CURRENCIES: ["USD", "EUR", "MXN", "COP", "ARS", "CLP"],
    SEAT_LIMIT: { min: 1, max: 1000 },
} as const;

const DB_ERRORS = {
    UNIQUE_VIOLATION: "23505",
    EMAIL_CONFLICT_KEY: "users_email_key",
    SLUG_CONFLICT_KEY: "companies_slug_key",
} as const;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

function validatePayload(payload: any): { valid: boolean; error?: string } {
    const { company_name, company_slug, admin_email, initial_plan, currency } = payload ?? {};
    if (!company_name?.trim() || !VALIDATION_RULES.NAME_REGEX.test(company_name.trim()))
        return { valid: false, error: "company_name is invalid (2-100 chars)" };
    if (!company_slug?.trim() || !VALIDATION_RULES.SLUG_REGEX.test(company_slug.trim()))
        return { valid: false, error: "company_slug must be lowercase alphanumeric with hyphens (3-50 chars)" };
    if (!admin_email?.trim() || !VALIDATION_RULES.EMAIL_REGEX.test(admin_email.trim()))
        return { valid: false, error: "admin_email is invalid" };
    if (initial_plan && !VALIDATION_RULES.VALID_PLANS.includes(initial_plan))
        return { valid: false, error: "invalid plan selection" };
    if (currency && !VALIDATION_RULES.VALID_CURRENCIES.includes(currency))
        return { valid: false, error: "invalid currency code" };
    return { valid: true };
}

async function getCachedResponse(supabase: SupabaseClient, key: string) {
    const { data } = await supabase.from("idempotency_keys").select("response_payload").eq("key", key).maybeSingle();
    return data?.response_payload;
}

// ✅ Helper: buscar usuario por email (auth.admin.getUserByEmail no existe en v2)
async function getUserByEmail(supabase: SupabaseClient, email: string) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data) return null;
    return data.users.find((u: any) => u.email === email) ?? null;
}

serve(async (req) => {
    const startTime = Date.now();

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders, status: 204 });
    }

    for (const envVar of REQUIRED_ENV_VARS) {
        if (!Deno.env.get(envVar)) {
            console.error(`[FATAL] Missing environment variable: ${envVar}`);
            return new Response(
                JSON.stringify({ error: "Server configuration error", code: "MISCONFIGURED" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }
    }

    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const idempotencyKey = req.headers.get("Idempotency-Key");
    let stage = "INITIALIZATION";
    let context: Record<string, any> = {};

    try {
        // 0. IDEMPOTENCY CHECK
        if (idempotencyKey) {
            const cached = await getCachedResponse(supabaseClient, idempotencyKey);
            if (cached) {
                console.log(`[IDEMPOTENCY] Returning cached response for: ${idempotencyKey}`);
                return new Response(JSON.stringify(cached), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }
        }

        // 1. AUTHORIZATION
        stage = "AUTHORIZATION";
        const authHeader = req.headers.get("Authorization");

        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid Authorization header", code: "UNAUTHORIZED" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const token = authHeader.replace("Bearer ", "");
        
        // Creamos un cliente temporal solo para validar el token (sin Service Role)
        const userClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await userClient.auth.getUser();

        if (authError || !user) {
            console.error(`[AUTHORIZATION] ❌ Auth error: ${authError?.message || "User not found"}`);
            return new Response(
                JSON.stringify({ 
                    error: "Invalid or expired token", 
                    code: "UNAUTHORIZED",
                    debug: authError?.message 
                }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data: adminProfile, error: profileError } = await supabaseClient
            .from("users")
            .select("is_super_admin")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError || !adminProfile?.is_super_admin) {
            return new Response(
                JSON.stringify({ error: "Super Admin required", code: "FORBIDDEN" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. VALIDATION
        stage = "VALIDATION";
        let payload: any;
        try {
            payload = await req.json();
        } catch {
            return new Response(
                JSON.stringify({ error: "Invalid JSON payload", code: "INVALID_PAYLOAD" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const validation = validatePayload(payload);
        if (!validation.valid) {
            return new Response(
                JSON.stringify({ error: validation.error, code: "VALIDATION_ERROR" }),
                { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { company_name, company_slug, admin_email, seat_limit, initial_plan, currency } = payload;
        const normalizedEmail = admin_email.toLowerCase().trim();
        const normalizedSlug = company_slug.toLowerCase().trim();
        const normalizedName = company_name.trim();

        context = { admin_email: normalizedEmail, company_slug: normalizedSlug };
        console.log(`[${stage}] 🚀 Starting provisioning for: ${normalizedEmail} | slug: ${normalizedSlug}`);

        // 3. STRIPE FLOW (Optional)
        stage = "STRIPE_FLOW";
        let stripeCustomerId: string | null = null;
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        const stripeRequired = Deno.env.get("STRIPE_REQUIRED") === "true";

        if (stripeKey) {
            try {
                const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
                const customer = await stripe.customers.create({
                    email: normalizedEmail,
                    name: normalizedName,
                    metadata: { company_slug: normalizedSlug, platform: "BETO OS", created_by: user.id }
                });
                stripeCustomerId = customer.id;
                console.log(`[STRIPE] ✅ Created customer: ${stripeCustomerId}`);
            } catch (err: any) {
                console.error(`[STRIPE] ❌ Error: ${err.message}`);
                if (stripeRequired) throw new Error(`Stripe customer creation failed (required): ${err.message}`);
            }
        }

        // 4. IDENTITY FLOW
        stage = "IDENTITY_FLOW";
        let targetUserId: string | null = null;
        let isExistingUser = false;

        // ✅ FIX: usar helper en lugar de auth.admin.getUserByEmail (no existe en v2)
        const existingUser = await getUserByEmail(supabaseClient, normalizedEmail);

        if (existingUser) {
            targetUserId = existingUser.id;
            isExistingUser = true;
            console.log(`[IDENTITY] ℹ️ User already exists: ${targetUserId}`);
        } else {
            // ✅ Invite en lugar de createUser — dispara email oficial de Supabase
            console.log(`[IDENTITY] 📧 Inviting new user: ${normalizedEmail}`);
                        targetUserId = recoveredUser.id;
                    } else {
                        const { data: profileSearch } = await supabaseClient
                            .from("users").select("id").eq("email", normalizedEmail).maybeSingle();
                        if (!profileSearch?.id) throw new Error("Identity resolution failed: Could not retrieve user ID");
                        targetUserId = profileSearch.id;
                    }
                    isExistingUser = true;
                } else {
                    throw inviteError;
                }
            } else {
                targetUserId = inviteData?.user?.id ?? null;
                console.log(`[IDENTITY] ✅ Invitation sent: ${targetUserId}`);
            }
        }

        if (!targetUserId) throw new Error("Identity resolution failed: No userId identified");

        // 5. PUBLIC USER SYNC
        stage = "SYNC_FLOW";
        console.log(`[${stage}] 🔄 Synchronizing public profile for: ${targetUserId}`);

        const { error: syncError } = await supabaseClient.from("users").upsert(
            {
                id: targetUserId,
                email: normalizedEmail,
                full_name: `Admin ${normalizedName}`,
                is_super_admin: false,
                updated_at: new Date().toISOString()
            },
            { onConflict: "id", ignoreDuplicates: false }
        );

        if (syncError) {
            console.error(`[${stage}] ❌ Profile sync failed: ${syncError.message}`);
            if (syncError.code === DB_ERRORS.UNIQUE_VIOLATION || syncError.message?.includes(DB_ERRORS.EMAIL_CONFLICT_KEY)) {
                return new Response(
                    JSON.stringify({ error: `Email ${normalizedEmail} is already associated with another account`, code: "EMAIL_CONFLICT" }),
                    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            throw new Error(`Database sync error: ${syncError.message}`);
        }

        // 6. TENANT PROVISIONING (RPC)
        stage = "PROVISION_FLOW";
        console.log(`[${stage}] 🏗️ Executing RPC: beto_provision_tenant_v2 for ${normalizedSlug}`);

        const { data: rpcData, error: rpcError } = await supabaseClient.rpc("beto_provision_tenant_v2", {
            p_company_name: normalizedName,
            p_company_slug: normalizedSlug,
            p_user_id: targetUserId,
            p_user_role: "admin"
        });

        if (rpcError) {
            console.error(`[${stage}] ❌ RPC error: ${rpcError.message}`);
            if (rpcError.code === DB_ERRORS.UNIQUE_VIOLATION || rpcError.message?.includes("duplicate")) {
                return new Response(
                    JSON.stringify({ error: `The slug '${normalizedSlug}' is already registered`, code: "DUPLICATE_SLUG" }),
                    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            throw rpcError;
        }

        const companyId = rpcData?.company_id;
        if (!companyId) throw new Error("RPC succeeded but returned no company_id");

        // 7. PLAN CONFIGURATION
        stage = "CONFIG_FLOW";
        const planApplied = initial_plan || "starter";

        const { data: planInfo } = await supabaseClient
            .from("subscription_plans").select("max_users").eq("slug", planApplied).maybeSingle();

        const seatLimitApplied = planInfo?.max_users || seat_limit || 5;

        const { error: updateError } = await supabaseClient.from("companies").update({
            subscription_tier: planApplied,
            seat_limit: seatLimitApplied,
            currency: currency || "USD",
            stripe_customer_id: stripeCustomerId,
            owner_id: targetUserId,
            updated_at: new Date().toISOString()
        }).eq("id", companyId);

        if (updateError) console.warn(`[CONFIG_FLOW] ⚠️ Update warning: ${updateError.message}`);

        // 8. RESULT & AUDIT
        const duration = Date.now() - startTime;
        const resultPayload = {
            success: true,
            company_id: companyId,
            user_id: targetUserId,
            status: "provisioned",
            message: isExistingUser ? "Company provisioned for existing user" : "Company provisioned and invitation sent",
            stripe_customer_id: stripeCustomerId
        };

        // ✅ FIX: .then() en lugar de .catch() — la v2 de supabase-js no tiene .catch() en QueryBuilder
        supabaseClient.from("delivery_logs").insert({
            user_id: user.id,
            company_id: companyId,
            channel: "system",
            event_type: "PROVISIONING_SUCCESS",
            status: "success",
            destination: normalizedEmail,
            duration_ms: duration,
            metadata: { company_slug: normalizedSlug, plan: planApplied, is_existing: isExistingUser, stripe_id: stripeCustomerId }
        }).then(({ error: logErr }: any) => {
            if (logErr) console.warn(`[AUDIT] ⚠️ Success log failed: ${logErr.message}`);
        });

        if (idempotencyKey) {
            supabaseClient.from("idempotency_keys").upsert({
                key: idempotencyKey,
                request_payload: payload,
                response_payload: resultPayload,
                created_at: new Date().toISOString()
            }, { onConflict: "key" }).then(({ error: iErr }: any) => {
                if (iErr) console.warn(`[IDEMPOTENCY] ⚠️ Failed to save key: ${iErr.message}`);
            });
        }

        console.log(`[✅ COMPLETE] Provisioning successful in ${duration}ms`);
        return new Response(
            JSON.stringify(resultPayload),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`[❌ CRITICAL] Stage: ${stage} | Duration: ${duration}ms | Error: ${error.message}`);

        supabaseClient.from("delivery_logs").insert({
            channel: "system",
            event_type: "PROVISIONING_FAILURE",
            status: "error",
            error_code: error.code || "INTERNAL_ERROR",
            error_message: error.message,
            duration_ms: duration,
            metadata: { ...context, stage, stack: Deno.env.get("ENV") === "development" ? error.stack : undefined }
        }).then(({ error: logErr }: any) => {
            if (logErr) console.error(`[AUDIT] ❌ Failure log failed: ${logErr.message}`);
        });

        const isAuthError = error.message?.includes("token") || error.message?.includes("auth");
        const isValidationError = stage === "VALIDATION";
        const isConflict = error.code === DB_ERRORS.UNIQUE_VIOLATION;

        const status = isAuthError ? 401 : isValidationError ? 422 : isConflict ? 409 : 500;
        const errorCode = isAuthError ? "UNAUTHORIZED" : isValidationError ? "INVALID_PAYLOAD" : isConflict ? "CONFLICT" : "INTERNAL_ERROR";
        const userMessage = isAuthError ? "Authentication failed" : isValidationError ? error.message : "Provisioning failed";

        return new Response(
            JSON.stringify({ error: userMessage, code: errorCode, stage, ...(Deno.env.get("ENV") === "development" && { debug: error.message }) }),
            { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});