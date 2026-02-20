


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO users (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."beto_provision_tenant"("p_company_name" "text", "p_company_slug" "text", "p_user_id" "uuid", "p_user_role" "text" DEFAULT 'admin'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_company_id UUID;
BEGIN
    -- A. Verificar si el usuario es Super Admin (solo BETO puede correr esto)
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only BETO can provision tenants.';
    END IF;

    -- B. Crear Company
    INSERT INTO public.companies (name, slug, subscription_status, subscription_tier)
    VALUES (p_company_name, p_company_slug, 'active', 'premium')
    RETURNING id INTO v_company_id;

    -- C. Crear Membresía
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (v_company_id, p_user_id, p_user_role);

    -- D. Establecer empresa por defecto
    UPDATE public.users
    SET default_company_id = v_company_id
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'company_id', v_company_id,
        'message', 'Tenant provisioned successfully'
    );
END;
$$;


ALTER FUNCTION "public"."beto_provision_tenant"("p_company_name" "text", "p_company_slug" "text", "p_user_id" "uuid", "p_user_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_soft_delete_company"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Solo si se está soft-deleting (deleted_at cambia de NULL a fecha)
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    
    -- Soft delete en products (si existe)
    UPDATE products 
    SET deleted_at = NEW.deleted_at, updated_at = NOW()
    WHERE company_id = NEW.id AND deleted_at IS NULL;
    
    -- Soft delete en inventory_movements (si existe)
    UPDATE inventory_movements 
    SET deleted_at = NEW.deleted_at
    WHERE company_id = NEW.id AND deleted_at IS NULL;
    
    RAISE NOTICE 'Soft deleted all data for company: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_soft_delete_company"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_company_user_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_users_count INTEGER;
BEGIN
    -- Contar usuarios activos en la empresa actual
    SELECT COUNT(*) INTO current_users_count
    FROM public.company_members
    WHERE company_id = NEW.company_id 
      AND is_active = true;

    IF current_users_count >= 3 THEN
        RAISE EXCEPTION 'User limit reached: Max 3 users per company allowed.';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_company_user_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_cross_tenant_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  material_company_id UUID;
  batch_company_id    UUID;
  batch_material_id   UUID;
BEGIN
  -- Bypass para service_role (migrations, seeders)
  IF (current_setting('role', true) = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- A. company_id obligatorio
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Integrity Error: company_id is required.';
  END IF;

  -- B. Validar que el raw_material pertenece a la misma company
  --    FIX: se consulta raw_materials (no products)
  SELECT company_id INTO material_company_id
  FROM raw_materials
  WHERE id = NEW.material_id;

  IF material_company_id IS NULL THEN
    RAISE EXCEPTION 'Integrity Error: material_id % does not exist.', NEW.material_id;
  END IF;

  IF material_company_id <> NEW.company_id THEN
    RAISE EXCEPTION
      'Cross-tenant Security Violation: material % belongs to a different company.',
      NEW.material_id;
  END IF;

  -- C. Validar Batch (si existe)
  IF NEW.batch_id IS NOT NULL THEN
    SELECT company_id, material_id
      INTO batch_company_id, batch_material_id
    FROM material_batches
    WHERE id = NEW.batch_id;

    IF batch_company_id IS NULL THEN
      RAISE EXCEPTION 'Integrity Error: batch_id % does not exist.', NEW.batch_id;
    END IF;

    -- C.1. Batch Ownership
    IF batch_company_id <> NEW.company_id THEN
      RAISE EXCEPTION
        'Cross-tenant Security Violation: batch % belongs to a different company.',
        NEW.batch_id;
    END IF;

    -- C.2. Consistencia vertical: el batch debe ser del mismo material
    IF batch_material_id <> NEW.material_id THEN
      RAISE EXCEPTION
        'Data Integrity Violation: batch % belongs to material %, not to %.',
        NEW.batch_id, batch_material_id, NEW.material_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_cross_tenant_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_environment_capacity"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT seat_limit, seat_count
  INTO v_limit, v_count
  FROM public.companies
  WHERE id = p_company_id;

  -- Default to safe if not found (or handle error)
  IF v_limit IS NULL THEN
    RETURN FALSE; 
  END IF;

  IF v_count >= v_limit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_environment_capacity"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."company_subscription_status"("cid" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT subscription_status 
  FROM companies 
  WHERE id = cid AND deleted_at IS NULL;
$$;


ALTER FUNCTION "public"."company_subscription_status"("cid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_company_with_owner"("company_name" "text", "company_slug" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  new_company_id UUID;
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  -- Validación sesión
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- Validación Single-Tenant (1 usuario = 1 empresa)
  IF EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'El usuario ya pertenece a una empresa.';
  END IF;

  -- Insert empresa (UNIQUE constraint en slug debe existir)
  INSERT INTO public.companies (
    name,
    slug,
    subscription_status,
    subscription_tier
  )
  VALUES (
    company_name,
    company_slug,
    'trialing',
    'starter'
  )
  RETURNING id INTO new_company_id;

  -- Insert membership owner
  INSERT INTO public.company_members (
    company_id,
    user_id,
    role
  )
  VALUES (
    new_company_id,
    current_user_id,
    'owner'
  );

  -- Update default_company_id
  UPDATE public.users
  SET default_company_id = new_company_id
  WHERE id = current_user_id;

  -- Construir respuesta
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'slug', c.slug
  )
  INTO result
  FROM public.companies c
  WHERE c.id = new_company_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."create_company_with_owner"("company_name" "text", "company_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_next_month_audit_partition"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_month_start DATE;
  next_month_end DATE;
  partition_name TEXT;
BEGIN

  next_month_start := date_trunc('month', NOW() + INTERVAL '1 month');
  next_month_end := next_month_start + INTERVAL '1 month';

  partition_name :=
    'audit_logs_' || to_char(next_month_start, 'YYYY_MM');

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = partition_name
  ) THEN

    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_logs
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month_start,
      next_month_end
    );

    RAISE NOTICE 'Created partition automatically: %', partition_name;

  ELSE
    RAISE NOTICE 'Partition already exists: %', partition_name;
  END IF;

END;
$$;


ALTER FUNCTION "public"."create_next_month_audit_partition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT auth.uid();
$$;


ALTER FUNCTION "public"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_company_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  access_level TEXT;
BEGIN
  -- Service Role Bypass (Importante para Webhooks)
  IF (current_setting('role', true) = 'service_role') THEN
    RETURN NEW;
  END IF;
  access_level := public.get_company_suspension_level(NEW.company_id);
  -- BLOCKED: Kill Switch Total
  IF access_level = 'blocked' THEN
    RAISE EXCEPTION 'Action blocked: Company is suspended/blocked.';
  END IF;
  -- READ_ONLY: Allow DELETE only
  IF access_level = 'read_only' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      RAISE EXCEPTION 'Read-only mode: Subscription past due. Writes disabled.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_company_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_environment_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN

  -- Only validate when inserting OR changing environment via UPDATE
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE'
         AND NEW.default_company_id IS DISTINCT FROM OLD.default_company_id)
  THEN

    -- Get capacity info for the NEW company
    SELECT seat_limit, seat_count
    INTO v_limit, v_count
    FROM public.companies
    WHERE id = NEW.default_company_id;
    
    -- Safety check if company doesn't exist or has no limit
    IF v_limit IS NOT NULL THEN
        -- Check if limit is reached
        -- We use >= because seat_count includes the current valid users. 
        -- Attempting to add one more (this transaction) should fail if we are at or above limit.
        IF v_count >= v_limit THEN
          RAISE EXCEPTION
            'BETO OS: Environment seat limit reached (%/%). Upgrade required.',
            v_count,
            v_limit;
        END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_environment_capacity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_user_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  max_allowed INT;
  current_count INT;
BEGIN
  -- Service Role Bypass
  IF (current_setting('role', true) = 'service_role') THEN
    RETURN NEW;
  END IF;
  -- 1. Obtener límite del plan
  SELECT sp.max_users INTO max_allowed
  FROM companies c
  JOIN subscription_plans sp ON c.subscription_tier = sp.slug
  WHERE c.id = NEW.company_id;
  -- 2. ATOMIC LOCK: Bloquear la fila de la COMPANY para serializar inserts concurrentes
  -- Esto previene "phantom reads" donde 2 requests cuentan 2 usuarios y ambos insertan el 3ro.
  PERFORM 1 FROM companies WHERE id = NEW.company_id FOR UPDATE;
  -- 3. Contar
  SELECT COUNT(*) INTO current_count
  FROM company_members
  WHERE company_id = NEW.company_id AND is_active = true;
  -- Note: FOR UPDATE on members is redundant if parent is locked, but harmless.
  -- 4. Validar
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Plan limit reached: Your plan allows max % users.', max_allowed;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_user_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_company_suspension_level"("cid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  stat TEXT;
  grace TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, grace_period_ends_at 
  INTO stat, grace
  FROM companies
  WHERE id = cid;
  
  RETURN public.get_suspension_level(stat, grace);
END;
$$;


ALTER FUNCTION "public"."get_company_suspension_level"("cid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_suspension_level"("status" "text", "grace_period_ends_at" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  -- 1. Casos de acceso total
  IF status IN ('trialing', 'active') THEN
    RETURN 'none';
  -- 2. Past Due con lógica de Gracia
  ELSIF status = 'past_due' THEN
    IF grace_period_ends_at IS NOT NULL AND grace_period_ends_at > NOW() THEN
      RETURN 'none'; 
    ELSE
      RETURN 'read_only';
    END IF;
  -- 3. Suspendido o Cancelado => Bloqueo total
  ELSIF status IN ('suspended', 'canceled') THEN
    RETURN 'blocked';
  -- 4. Fallback seguro
  ELSE
    RETURN 'blocked';
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_suspension_level"("status" "text", "grace_period_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_company_billing_init"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.billing_accounts (company_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_company_billing_init"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role_level"("cid" "uuid", "min_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  role_hierarchy TEXT[] := ARRAY['viewer', 'operator', 'manager', 'admin', 'owner'];
  user_role TEXT;
  user_level INT;
  required_level INT;
BEGIN
  -- Obtener rol del usuario
  user_role := public.user_role_in_company(cid);
  
  -- Si no tiene rol, denegar
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Calcular niveles
  user_level := array_position(role_hierarchy, user_role);
  required_level := array_position(role_hierarchy, min_role);
  
  -- Verificar jerarquía
  RETURN user_level >= required_level;
END;
$$;


ALTER FUNCTION "public"."has_role_level"("cid" "uuid", "min_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_active"("cid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_status TEXT;
    v_sub_status TEXT;
    v_grace BOOLEAN;
BEGIN
    -- Obtenemos el status de suscripción y verificamos periodo de gracia
    SELECT 
        c.subscription_status, 
        ba.billing_status,
        public.is_within_grace_period(cid)
    INTO v_status, v_sub_status, v_grace
    FROM public.companies c
    LEFT JOIN public.billing_accounts ba ON ba.company_id = c.id
    WHERE c.id = cid AND c.deleted_at IS NULL;

    -- Acceso permitido si:
    -- 1. Status es active o trialing
    -- 2. Status es past_due pero está en periodo de gracia
    RETURN (v_status IN ('active', 'trialing')) OR (v_status = 'past_due' AND v_grace);
END;
$$;


ALTER FUNCTION "public"."is_company_active"("cid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_company_member"("target_company" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id = target_company
  );
$$;


ALTER FUNCTION "public"."is_company_member"("target_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM users WHERE id = public.user_id()),
    false
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_within_grace_period"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_status TEXT;
    v_period_end TIMESTAMPTZ;
BEGIN
    SELECT billing_status, current_period_end INTO v_status, v_period_end
    FROM public.billing_accounts
    WHERE company_id = p_company_id;

    -- Si está en past_due, permitimos acceso por un margen de 7 días (Grace Period)
    IF v_status = 'past_due' AND v_period_end > (now() - interval '7 days') THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;


ALTER FUNCTION "public"."is_within_grace_period"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_last_owner_removal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  -- Solo verificar si es owner
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.is_active = false)) THEN
    
    -- Contar owners activos restantes (excluyendo el actual)
    SELECT COUNT(*) INTO owner_count
    FROM company_members
    WHERE company_id = OLD.company_id 
      AND role = 'owner' 
      AND is_active = true
      AND id != OLD.id;
    
    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of company. At least one active owner is required.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."prevent_last_owner_removal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  role_hierarchy TEXT[] := ARRAY['viewer', 'operator', 'manager', 'admin', 'owner'];
  modifier_role TEXT;
  modifier_level INT;
  old_level INT;
  new_level INT;
  current_user_id UUID;
BEGIN
  -- Solo aplicar en UPDATE de rol
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    
    -- Obtener el user_id actual (quien hace la modificación)
    current_user_id := auth.user_id();
    
    -- REGLA 1: No puede modificar su propio rol
    IF NEW.user_id = current_user_id THEN
      RAISE EXCEPTION 'Cannot modify your own role. Self-role-escalation is not allowed.';
    END IF;
    
    -- REGLA 2: Solo puede escalar roles hasta su propio nivel (o inferior)
    -- Obtener rol del modificador
    SELECT role INTO modifier_role
    FROM company_members
    WHERE company_id = NEW.company_id 
      AND user_id = current_user_id
      AND is_active = true;
    
    -- Si no se encontró rol (super admin bypasea este check)
    IF modifier_role IS NULL THEN
      -- Verificar si es super admin
      IF NOT auth.is_super_admin() THEN
        RAISE EXCEPTION 'Modifier has no role in this company';
      END IF;
      -- Super admin puede hacer cualquier cambio
      RETURN NEW;
    END IF;
    
    -- Calcular niveles
    modifier_level := array_position(role_hierarchy, modifier_role);
    old_level := array_position(role_hierarchy, OLD.role);
    new_level := array_position(role_hierarchy, NEW.role);
    
    -- Verificar que el nuevo rol no sea superior al del modificador
    IF new_level > modifier_level THEN
      RAISE EXCEPTION 'Cannot escalate role to % (level %). Your role is % (level %).', 
        NEW.role, new_level, modifier_role, modifier_level;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_role_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_company_user_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Count only members who are NOT super admins (if we can identify them in members table)
  -- If super admins don't have member records, then they are already excluded!
  -- Requirement Says: "DO NOT create user records per company."
  -- So if Founder accesses environment WITHOUT a member record, they won't be counted in `company_members`.
  -- Thus, `select count(*) from company_members` will inherently exclude them.
  -- 
  -- BUT, if we *did* add them as support users previously, we might need to filter.
  -- For now, the "Impersonation Context" approach avoids creating member records.
  
  -- So the only change needed is ensuring the TRIGGER doesn't block *operations* by Super Admin
  -- if they *were* to be added (though we shouldn't add them).
  
  update public.companies
  set seat_count = (
    select count(*) 
    from public.company_members cm
    -- join auth.users u on cm.user_id = u.id  <-- If we needed to check metadata
    where cm.company_id = NEW.company_id
  )
  where id = NEW.company_id;
  
  return NEW;
end;
$$;


ALTER FUNCTION "public"."sync_company_user_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_super_admin_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update auth.users metadata
  -- We use SECURITY DEFINER to allow updating auth schema
  UPDATE auth.users
  SET raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('is_super_admin', NEW.is_super_admin)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_super_admin_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_companies"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT company_id 
  FROM company_members
  WHERE user_id = public.user_id() 
    AND is_active = true;
$$;


ALTER FUNCTION "public"."user_companies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'sub',
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::UUID;
$$;


ALTER FUNCTION "public"."user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_role_in_company"("cid" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role 
  FROM company_members
  WHERE company_id = cid 
    AND user_id = public.user_id() 
    AND is_active = true
  LIMIT 1;
$$;


ALTER FUNCTION "public"."user_role_in_company"("cid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_2026_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_2026_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_2026_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_2026_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_2026_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_2026_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_2026_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_2026_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_2026_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_2026_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_2026_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_2026_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan_tier" "text" DEFAULT 'starter'::"text",
    "billing_status" "text" DEFAULT 'trialing'::"text",
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "previous_status" "text",
    "new_status" "text",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subscription_status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "subscription_tier" "text" DEFAULT 'starter'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "grace_period_ends_at" timestamp with time zone,
    "current_period_ends_at" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "seat_limit" integer DEFAULT 1,
    "seat_count" integer DEFAULT 0,
    "billing_increment" integer DEFAULT 3,
    "stripe_price_id" "text",
    "current_period_end" timestamp with time zone,
    CONSTRAINT "companies_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'past_due'::"text", 'suspended'::"text", 'canceled'::"text"])))
);

ALTER TABLE ONLY "public"."companies" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'operator'::"text", 'viewer'::"text"])))
);

ALTER TABLE ONLY "public"."company_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_usage_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "active_users_count" integer DEFAULT 0,
    "products_count" integer DEFAULT 0,
    "storage_used_mb" numeric(12,2) DEFAULT 0,
    "ai_requests_count" integer DEFAULT 0,
    "is_snapshot" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_usage_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_actions_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "admin_email" "text" NOT NULL,
    "admin_role" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "affected_company_id" "uuid",
    "justification" "text" NOT NULL,
    "support_ticket_id" "text",
    "changes_made" "jsonb" DEFAULT '{}'::"jsonb",
    "requires_approval" boolean DEFAULT false,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "executed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "internal_actions_log_justification_check" CHECK (("length"("justification") >= 20))
);


ALTER TABLE "public"."internal_actions_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text",
    "initial_quantity" numeric(12,4) NOT NULL,
    "remaining_quantity" numeric(12,4) NOT NULL,
    "unit_cost" numeric(12,4) NOT NULL,
    "reference" "text",
    "width" numeric(10,2),
    "length" numeric(10,2),
    "area" numeric(10,2),
    "entry_mode" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "material_batches_entry_mode_check" CHECK (("entry_mode" = ANY (ARRAY['rollo'::"text", 'pieza'::"text"])))
);


ALTER TABLE "public"."material_batches" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."platform_metrics" AS
 SELECT "count"(*) AS "total_tenants",
    "count"(*) FILTER (WHERE ("subscription_status" = 'active'::"text")) AS "active_tenants",
    "count"(*) FILTER (WHERE ("subscription_status" = 'suspended'::"text")) AS "suspended_tenants",
    "count"(*) FILTER (WHERE ("deleted_at" IS NOT NULL)) AS "deleted_tenants",
    "sum"(
        CASE
            WHEN (("subscription_status" = 'active'::"text") AND ("subscription_tier" = 'premium'::"text")) THEN 49.00
            WHEN (("subscription_status" = 'active'::"text") AND ("subscription_tier" = 'enterprise'::"text")) THEN 149.00
            ELSE (0)::numeric
        END) AS "mrr_estimate"
   FROM "public"."companies"
  WHERE ("deleted_at" IS NULL);


ALTER VIEW "public"."platform_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reference" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "target_margin" numeric(5,2) DEFAULT 0,
    "cost_fifo" numeric(12,2) DEFAULT 0,
    "materials" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'activa'::"text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['activa'::"text", 'inactiva'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."raw_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text",
    "unit" "text",
    "provider" "text",
    "status" "text" DEFAULT 'activa'::"text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "raw_materials_status_check" CHECK (("status" = ANY (ARRAY['activa'::"text", 'inactiva'::"text"]))),
    CONSTRAINT "raw_materials_unit_check" CHECK (("unit" = ANY (ARRAY['metro'::"text", 'cm'::"text", 'kg'::"text", 'gramo'::"text", 'bobina'::"text", 'unidad'::"text", 'litro'::"text"])))
);


ALTER TABLE "public"."raw_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "batch_id" "uuid",
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" NOT NULL,
    "quantity" numeric(12,4) NOT NULL,
    "unit_cost" numeric(12,4) NOT NULL,
    "reference" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movements_type_check" CHECK (("type" = ANY (ARRAY['ingreso'::"text", 'egreso'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "subscription_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processed'::"text", 'failed'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."subscription_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "monthly_price_cents" integer DEFAULT 0 NOT NULL,
    "yearly_price_cents" integer DEFAULT 0 NOT NULL,
    "max_users" integer DEFAULT 5 NOT NULL,
    "max_products" integer DEFAULT 100 NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "max_storage_mb" integer DEFAULT 0 NOT NULL,
    "max_ai_requests_monthly" integer DEFAULT 0 NOT NULL,
    "stripe_monthly_price_id" "text",
    "stripe_yearly_price_id" "text",
    CONSTRAINT "subscription_plans_max_products_check" CHECK (("max_products" > 0)),
    CONSTRAINT "subscription_plans_max_users_check" CHECK (("max_users" > 0)),
    CONSTRAINT "subscription_plans_monthly_price_cents_check" CHECK (("monthly_price_cents" >= 0)),
    CONSTRAINT "subscription_plans_yearly_price_cents_check" CHECK (("yearly_price_cents" >= 0))
);

ALTER TABLE ONLY "public"."subscription_plans" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "is_super_admin" boolean DEFAULT false NOT NULL,
    "default_company_id" "uuid",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_members_view" AS
 SELECT "cm"."id",
    "cm"."company_id",
    "cm"."user_id",
    "cm"."role",
    "cm"."is_active",
    "u"."full_name",
    "u"."email",
    "au"."last_sign_in_at",
    "cm"."created_at" AS "joined_at",
    "au"."invited_at",
    "au"."confirmation_sent_at"
   FROM (("public"."company_members" "cm"
     JOIN "public"."users" "u" ON (("u"."id" = "cm"."user_id")))
     JOIN "auth"."users" "au" ON (("au"."id" = "cm"."user_id")))
  WHERE (("cm"."company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) OR "public"."is_super_admin"());


ALTER VIEW "public"."team_members_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."team_members_view" IS 'Capa canónica para acceder a datos de equipo sin acoplamiento directo a esquemas de auth.';



ALTER TABLE ONLY "public"."audit_logs" ATTACH PARTITION "public"."audit_logs_2026_02" FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_logs" ATTACH PARTITION "public"."audit_logs_2026_03" FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_logs" ATTACH PARTITION "public"."audit_logs_2026_04" FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_logs" ATTACH PARTITION "public"."audit_logs_2026_05" FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_logs" ATTACH PARTITION "public"."audit_logs_2026_06" FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_logs" ATTACH PARTITION "public"."audit_logs_2026_07" FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs_2026_02"
    ADD CONSTRAINT "audit_logs_2026_02_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs_2026_03"
    ADD CONSTRAINT "audit_logs_2026_03_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs_2026_04"
    ADD CONSTRAINT "audit_logs_2026_04_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs_2026_05"
    ADD CONSTRAINT "audit_logs_2026_05_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs_2026_06"
    ADD CONSTRAINT "audit_logs_2026_06_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."audit_logs_2026_07"
    ADD CONSTRAINT "audit_logs_2026_07_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."billing_logs"
    ADD CONSTRAINT "billing_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_usage_metrics"
    ADD CONSTRAINT "company_usage_metrics_company_id_period_start_is_snapshot_key" UNIQUE ("company_id", "period_start", "is_snapshot");



ALTER TABLE ONLY "public"."company_usage_metrics"
    ADD CONSTRAINT "company_usage_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_user_unique" UNIQUE ("company_id", "user_id");



ALTER TABLE ONLY "public"."internal_actions_log"
    ADD CONSTRAINT "internal_actions_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_batches"
    ADD CONSTRAINT "material_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_materials"
    ADD CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_action_idx" ON ONLY "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "audit_logs_2026_02_action_idx" ON "public"."audit_logs_2026_02" USING "btree" ("action");



CREATE INDEX "audit_logs_company_idx" ON ONLY "public"."audit_logs" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_02_company_id_created_at_idx" ON "public"."audit_logs_2026_02" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_resource_idx" ON ONLY "public"."audit_logs" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_2026_02_resource_type_resource_id_idx" ON "public"."audit_logs_2026_02" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_user_idx" ON ONLY "public"."audit_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_02_user_id_created_at_idx" ON "public"."audit_logs_2026_02" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_03_action_idx" ON "public"."audit_logs_2026_03" USING "btree" ("action");



CREATE INDEX "audit_logs_2026_03_company_id_created_at_idx" ON "public"."audit_logs_2026_03" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_03_resource_type_resource_id_idx" ON "public"."audit_logs_2026_03" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_2026_03_user_id_created_at_idx" ON "public"."audit_logs_2026_03" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_04_action_idx" ON "public"."audit_logs_2026_04" USING "btree" ("action");



CREATE INDEX "audit_logs_2026_04_company_id_created_at_idx" ON "public"."audit_logs_2026_04" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_04_resource_type_resource_id_idx" ON "public"."audit_logs_2026_04" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_2026_04_user_id_created_at_idx" ON "public"."audit_logs_2026_04" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_05_action_idx" ON "public"."audit_logs_2026_05" USING "btree" ("action");



CREATE INDEX "audit_logs_2026_05_company_id_created_at_idx" ON "public"."audit_logs_2026_05" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_05_resource_type_resource_id_idx" ON "public"."audit_logs_2026_05" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_2026_05_user_id_created_at_idx" ON "public"."audit_logs_2026_05" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_06_action_idx" ON "public"."audit_logs_2026_06" USING "btree" ("action");



CREATE INDEX "audit_logs_2026_06_company_id_created_at_idx" ON "public"."audit_logs_2026_06" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_06_resource_type_resource_id_idx" ON "public"."audit_logs_2026_06" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_2026_06_user_id_created_at_idx" ON "public"."audit_logs_2026_06" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_07_action_idx" ON "public"."audit_logs_2026_07" USING "btree" ("action");



CREATE INDEX "audit_logs_2026_07_company_id_created_at_idx" ON "public"."audit_logs_2026_07" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "audit_logs_2026_07_resource_type_resource_id_idx" ON "public"."audit_logs_2026_07" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "audit_logs_2026_07_user_id_created_at_idx" ON "public"."audit_logs_2026_07" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "batches_company_material_idx" ON "public"."material_batches" USING "btree" ("company_id", "material_id");



CREATE INDEX "companies_deleted_at_idx" ON "public"."companies" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "companies_slug_unique" ON "public"."companies" USING "btree" ("slug") WHERE ("deleted_at" IS NULL);



CREATE INDEX "companies_stripe_customer_idx" ON "public"."companies" USING "btree" ("stripe_customer_id");



CREATE INDEX "companies_subscription_status_idx" ON "public"."companies" USING "btree" ("subscription_status");



CREATE INDEX "company_members_active_idx" ON "public"."company_members" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "company_members_company_role_idx" ON "public"."company_members" USING "btree" ("company_id", "role");



CREATE INDEX "company_members_user_company_idx" ON "public"."company_members" USING "btree" ("user_id", "company_id");



CREATE INDEX "idx_companies_period_end" ON "public"."companies" USING "btree" ("current_period_ends_at");



CREATE INDEX "idx_companies_stripe_customer" ON "public"."companies" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_companies_stripe_sub_id" ON "public"."companies" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_companies_stripe_subscription" ON "public"."companies" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_company_members_company" ON "public"."company_members" USING "btree" ("company_id");



CREATE INDEX "idx_company_members_user" ON "public"."company_members" USING "btree" ("user_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "internal_actions_admin_idx" ON "public"."internal_actions_log" USING "btree" ("admin_user_id");



CREATE INDEX "internal_actions_company_idx" ON "public"."internal_actions_log" USING "btree" ("affected_company_id");



CREATE INDEX "internal_actions_date_idx" ON "public"."internal_actions_log" USING "btree" ("executed_at" DESC);



CREATE INDEX "movements_company_idx" ON "public"."stock_movements" USING "btree" ("company_id", "date");



CREATE INDEX "products_company_idx" ON "public"."products" USING "btree" ("company_id");



CREATE INDEX "products_deleted_idx" ON "public"."products" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "raw_materials_company_idx" ON "public"."raw_materials" USING "btree" ("company_id");



CREATE INDEX "subscription_plans_slug_idx" ON "public"."subscription_plans" USING "btree" ("slug");



CREATE INDEX "usage_metrics_company_period_idx" ON "public"."company_usage_metrics" USING "btree" ("company_id", "period_start" DESC);



CREATE INDEX "users_default_company_idx" ON "public"."users" USING "btree" ("default_company_id");



CREATE INDEX "users_email_idx" ON "public"."users" USING "btree" ("email");



ALTER INDEX "public"."audit_logs_action_idx" ATTACH PARTITION "public"."audit_logs_2026_02_action_idx";



ALTER INDEX "public"."audit_logs_company_idx" ATTACH PARTITION "public"."audit_logs_2026_02_company_id_created_at_idx";



ALTER INDEX "public"."audit_logs_pkey" ATTACH PARTITION "public"."audit_logs_2026_02_pkey";



ALTER INDEX "public"."audit_logs_resource_idx" ATTACH PARTITION "public"."audit_logs_2026_02_resource_type_resource_id_idx";



ALTER INDEX "public"."audit_logs_user_idx" ATTACH PARTITION "public"."audit_logs_2026_02_user_id_created_at_idx";



ALTER INDEX "public"."audit_logs_action_idx" ATTACH PARTITION "public"."audit_logs_2026_03_action_idx";



ALTER INDEX "public"."audit_logs_company_idx" ATTACH PARTITION "public"."audit_logs_2026_03_company_id_created_at_idx";



ALTER INDEX "public"."audit_logs_pkey" ATTACH PARTITION "public"."audit_logs_2026_03_pkey";



ALTER INDEX "public"."audit_logs_resource_idx" ATTACH PARTITION "public"."audit_logs_2026_03_resource_type_resource_id_idx";



ALTER INDEX "public"."audit_logs_user_idx" ATTACH PARTITION "public"."audit_logs_2026_03_user_id_created_at_idx";



ALTER INDEX "public"."audit_logs_action_idx" ATTACH PARTITION "public"."audit_logs_2026_04_action_idx";



ALTER INDEX "public"."audit_logs_company_idx" ATTACH PARTITION "public"."audit_logs_2026_04_company_id_created_at_idx";



ALTER INDEX "public"."audit_logs_pkey" ATTACH PARTITION "public"."audit_logs_2026_04_pkey";



ALTER INDEX "public"."audit_logs_resource_idx" ATTACH PARTITION "public"."audit_logs_2026_04_resource_type_resource_id_idx";



ALTER INDEX "public"."audit_logs_user_idx" ATTACH PARTITION "public"."audit_logs_2026_04_user_id_created_at_idx";



ALTER INDEX "public"."audit_logs_action_idx" ATTACH PARTITION "public"."audit_logs_2026_05_action_idx";



ALTER INDEX "public"."audit_logs_company_idx" ATTACH PARTITION "public"."audit_logs_2026_05_company_id_created_at_idx";



ALTER INDEX "public"."audit_logs_pkey" ATTACH PARTITION "public"."audit_logs_2026_05_pkey";



ALTER INDEX "public"."audit_logs_resource_idx" ATTACH PARTITION "public"."audit_logs_2026_05_resource_type_resource_id_idx";



ALTER INDEX "public"."audit_logs_user_idx" ATTACH PARTITION "public"."audit_logs_2026_05_user_id_created_at_idx";



ALTER INDEX "public"."audit_logs_action_idx" ATTACH PARTITION "public"."audit_logs_2026_06_action_idx";



ALTER INDEX "public"."audit_logs_company_idx" ATTACH PARTITION "public"."audit_logs_2026_06_company_id_created_at_idx";



ALTER INDEX "public"."audit_logs_pkey" ATTACH PARTITION "public"."audit_logs_2026_06_pkey";



ALTER INDEX "public"."audit_logs_resource_idx" ATTACH PARTITION "public"."audit_logs_2026_06_resource_type_resource_id_idx";



ALTER INDEX "public"."audit_logs_user_idx" ATTACH PARTITION "public"."audit_logs_2026_06_user_id_created_at_idx";



ALTER INDEX "public"."audit_logs_action_idx" ATTACH PARTITION "public"."audit_logs_2026_07_action_idx";



ALTER INDEX "public"."audit_logs_company_idx" ATTACH PARTITION "public"."audit_logs_2026_07_company_id_created_at_idx";



ALTER INDEX "public"."audit_logs_pkey" ATTACH PARTITION "public"."audit_logs_2026_07_pkey";



ALTER INDEX "public"."audit_logs_resource_idx" ATTACH PARTITION "public"."audit_logs_2026_07_resource_type_resource_id_idx";



ALTER INDEX "public"."audit_logs_user_idx" ATTACH PARTITION "public"."audit_logs_2026_07_user_id_created_at_idx";



CREATE OR REPLACE TRIGGER "cascade_soft_delete_trigger" AFTER UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_soft_delete_company"();



CREATE OR REPLACE TRIGGER "check_users_limit" BEFORE INSERT ON "public"."company_members" FOR EACH ROW WHEN (("new"."is_active" = true)) EXECUTE FUNCTION "public"."enforce_user_limit"();



CREATE OR REPLACE TRIGGER "on_user_super_admin_change" AFTER UPDATE OF "is_super_admin" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_super_admin_status"();



CREATE OR REPLACE TRIGGER "on_user_super_admin_insert" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_super_admin_status"();



CREATE OR REPLACE TRIGGER "prevent_last_owner_removal_trigger" BEFORE DELETE OR UPDATE ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_owner_removal"();



CREATE OR REPLACE TRIGGER "prevent_role_escalation_trigger" BEFORE UPDATE ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_escalation"();



CREATE OR REPLACE TRIGGER "prevent_writes_suspended" BEFORE INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_company_status"();



CREATE OR REPLACE TRIGGER "trg_check_integrity" BEFORE INSERT OR UPDATE ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."check_cross_tenant_integrity"();



CREATE OR REPLACE TRIGGER "trg_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_company_members_updated_at" BEFORE UPDATE ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_capacity" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_environment_capacity"();



CREATE OR REPLACE TRIGGER "trg_enforce_capacity_update" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_environment_capacity"();



CREATE OR REPLACE TRIGGER "trg_init_company_billing" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_company_billing_init"();



CREATE OR REPLACE TRIGGER "trg_limit_company_users" BEFORE INSERT ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."check_company_user_limit"();



CREATE OR REPLACE TRIGGER "trg_prevent_last_owner_removal" BEFORE DELETE OR UPDATE OF "role", "is_active" ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_owner_removal"();



CREATE OR REPLACE TRIGGER "trg_user_delete_sync" AFTER DELETE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_company_user_count"();



CREATE OR REPLACE TRIGGER "trg_user_insert_sync" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_company_user_count"();



CREATE OR REPLACE TRIGGER "trg_user_update_sync" AFTER UPDATE OF "default_company_id" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_company_user_count"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_batches_updated_at" BEFORE UPDATE ON "public"."material_batches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_members_updated_at" BEFORE UPDATE ON "public"."company_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_raw_materials_updated_at" BEFORE UPDATE ON "public"."raw_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_logs"
    ADD CONSTRAINT "billing_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_usage_metrics"
    ADD CONSTRAINT "company_usage_metrics_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_actions_log"
    ADD CONSTRAINT "internal_actions_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."internal_actions_log"
    ADD CONSTRAINT "internal_actions_log_affected_company_id_fkey" FOREIGN KEY ("affected_company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."internal_actions_log"
    ADD CONSTRAINT "internal_actions_log_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."material_batches"
    ADD CONSTRAINT "material_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_batches"
    ADD CONSTRAINT "material_batches_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."raw_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raw_materials"
    ADD CONSTRAINT "raw_materials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."material_batches"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."raw_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_default_company_id_fkey" FOREIGN KEY ("default_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow insert from trigger" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for authenticated users belonging to company" ON "public"."companies" FOR SELECT USING ((("auth"."uid"() IN ( SELECT "company_members"."user_id"
   FROM "public"."company_members"
  WHERE ("company_members"."company_id" = "companies"."id"))) OR "public"."is_super_admin"()));



CREATE POLICY "Enable update for company admins" ON "public"."companies" FOR UPDATE USING ((("auth"."uid"() IN ( SELECT "company_members"."user_id"
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "companies"."id") AND ("company_members"."role" = 'admin'::"text")))) OR "public"."is_super_admin"()));



CREATE POLICY "Users can select themselves" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update themselves" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "audit_logs_limited_delete" ON "public"."audit_logs" FOR DELETE USING (("public"."is_super_admin"() AND ("created_at" < ("now"() - '90 days'::interval))));



CREATE POLICY "audit_logs_no_update" ON "public"."audit_logs" FOR UPDATE USING (false);



CREATE POLICY "audit_logs_select" ON "public"."audit_logs" FOR SELECT USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."company_id" = "audit_logs"."company_id") AND ("cm"."user_id" = "public"."user_id"()) AND ("cm"."is_active" = true))))));



CREATE POLICY "batches_delete" ON "public"."material_batches" FOR DELETE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'manager'::"text"))));



CREATE POLICY "batches_insert" ON "public"."material_batches" FOR INSERT WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



CREATE POLICY "batches_select" ON "public"."material_batches" FOR SELECT USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND ("deleted_at" IS NULL))));



CREATE POLICY "batches_update" ON "public"."material_batches" FOR UPDATE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text")))) WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



ALTER TABLE "public"."billing_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_accounts_all" ON "public"."billing_accounts" USING ("public"."is_super_admin"());



ALTER TABLE "public"."billing_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_logs_select" ON "public"."billing_logs" FOR SELECT USING (("public"."is_super_admin"() OR ("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies"))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_delete" ON "public"."companies" FOR DELETE USING (("public"."is_super_admin"() OR "public"."has_role_level"("id", 'owner'::"text")));



CREATE POLICY "companies_insert" ON "public"."companies" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "companies_onboarding_insert" ON "public"."companies" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE ("company_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "companies_select" ON "public"."companies" FOR SELECT USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."company_id" = "companies"."id") AND ("cm"."user_id" = "public"."user_id"()) AND ("cm"."is_active" = true))))));



CREATE POLICY "companies_update" ON "public"."companies" FOR UPDATE USING (("public"."is_super_admin"() OR "public"."has_role_level"("id", 'owner'::"text")));



ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_members_select" ON "public"."company_members" FOR SELECT USING ("public"."is_company_member"("company_id"));



ALTER TABLE "public"."company_usage_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_actions_all" ON "public"."internal_actions_log" USING ("public"."is_super_admin"());



ALTER TABLE "public"."internal_actions_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membership_onboarding_insert" ON "public"."company_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"text") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."company_members" "company_members_1"
  WHERE ("company_members_1"."user_id" = "auth"."uid"()))))));



CREATE POLICY "movements_delete" ON "public"."stock_movements" FOR DELETE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'manager'::"text"))));



CREATE POLICY "movements_insert" ON "public"."stock_movements" FOR INSERT WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



CREATE POLICY "movements_select" ON "public"."stock_movements" FOR SELECT USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND ("deleted_at" IS NULL))));



CREATE POLICY "movements_update" ON "public"."stock_movements" FOR UPDATE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'manager'::"text")))) WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'manager'::"text"))));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_delete" ON "public"."products" FOR DELETE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'manager'::"text"))));



CREATE POLICY "products_insert" ON "public"."products" FOR INSERT WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



CREATE POLICY "products_select" ON "public"."products" FOR SELECT USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND ("deleted_at" IS NULL))));



CREATE POLICY "products_select_policy" ON "public"."products" FOR SELECT USING (("company_id" IN ( SELECT "company_members"."company_id"
   FROM "public"."company_members"
  WHERE (("company_members"."user_id" = "auth"."uid"()) AND ("company_members"."is_active" = true)))));



CREATE POLICY "products_update" ON "public"."products" FOR UPDATE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text")))) WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



ALTER TABLE "public"."raw_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "raw_materials_delete" ON "public"."raw_materials" FOR DELETE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'manager'::"text"))));



CREATE POLICY "raw_materials_insert" ON "public"."raw_materials" FOR INSERT WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



CREATE POLICY "raw_materials_select" ON "public"."raw_materials" FOR SELECT USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND ("deleted_at" IS NULL))));



CREATE POLICY "raw_materials_update" ON "public"."raw_materials" FOR UPDATE USING (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text")))) WITH CHECK (("public"."is_super_admin"() OR (("company_id" IN ( SELECT "public"."user_companies"() AS "user_companies")) AND "public"."has_role_level"("company_id", 'operator'::"text"))));



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_events_deny_update" ON "public"."subscription_events" FOR UPDATE USING (false);



CREATE POLICY "subscription_events_deny_write" ON "public"."subscription_events" FOR INSERT WITH CHECK (false);



CREATE POLICY "subscription_events_select" ON "public"."subscription_events" FOR SELECT USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."company_id" = "subscription_events"."company_id") AND ("cm"."user_id" = "public"."user_id"()))))));



ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_plans_modify" ON "public"."subscription_plans" USING ("public"."is_super_admin"());



CREATE POLICY "subscription_plans_select" ON "public"."subscription_plans" FOR SELECT USING (true);



CREATE POLICY "usage_metrics_select" ON "public"."company_usage_metrics" FOR SELECT USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."company_id" = "company_usage_metrics"."company_id") AND ("cm"."user_id" = "public"."user_id"()))))));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert" ON "public"."users" FOR INSERT WITH CHECK (("id" = "public"."user_id"()));



CREATE POLICY "users_select" ON "public"."users" FOR SELECT USING (("public"."is_super_admin"() OR ("id" = "public"."user_id"()) OR (EXISTS ( SELECT 1
   FROM "public"."company_members" "cm"
  WHERE (("cm"."user_id" = "users"."id") AND ("cm"."company_id" IN ( SELECT "company_members"."company_id"
           FROM "public"."company_members"
          WHERE (("company_members"."user_id" = "public"."user_id"()) AND ("company_members"."is_active" = true)))))))));



CREATE POLICY "users_update" ON "public"."users" FOR UPDATE USING (("public"."is_super_admin"() OR ("id" = "public"."user_id"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO "anon";
GRANT ALL ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";


































































































































































REVOKE ALL ON FUNCTION "public"."beto_provision_tenant"("p_company_name" "text", "p_company_slug" "text", "p_user_id" "uuid", "p_user_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."beto_provision_tenant"("p_company_name" "text", "p_company_slug" "text", "p_user_id" "uuid", "p_user_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_company_with_owner"("company_name" "text", "company_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_company_with_owner"("company_name" "text", "company_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_company_with_owner"("company_name" "text", "company_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_company_suspension_level"("cid" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_suspension_level"("status" "text", "grace_period_ends_at" timestamp with time zone) TO "authenticated";



























GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_02" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_02" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_03" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_03" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_04" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_04" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_05" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_05" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_06" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_06" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_07" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs_2026_07" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."billing_accounts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."billing_accounts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."billing_logs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."billing_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."companies" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."companies" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_members" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_members" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_usage_metrics" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."company_usage_metrics" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."internal_actions_log" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."internal_actions_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."material_batches" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."material_batches" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."platform_metrics" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."platform_metrics" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."products" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."products" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."raw_materials" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."raw_materials" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stock_movements" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stock_movements" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."subscription_events" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."subscription_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."subscription_plans" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."users" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_members_view" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_members_view" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";




























drop extension if exists "pg_net";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke references on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke delete on table "public"."audit_logs_2026_02" from "anon";

revoke insert on table "public"."audit_logs_2026_02" from "anon";

revoke references on table "public"."audit_logs_2026_02" from "anon";

revoke select on table "public"."audit_logs_2026_02" from "anon";

revoke trigger on table "public"."audit_logs_2026_02" from "anon";

revoke truncate on table "public"."audit_logs_2026_02" from "anon";

revoke update on table "public"."audit_logs_2026_02" from "anon";

revoke references on table "public"."audit_logs_2026_02" from "authenticated";

revoke trigger on table "public"."audit_logs_2026_02" from "authenticated";

revoke truncate on table "public"."audit_logs_2026_02" from "authenticated";

revoke references on table "public"."audit_logs_2026_02" from "service_role";

revoke trigger on table "public"."audit_logs_2026_02" from "service_role";

revoke truncate on table "public"."audit_logs_2026_02" from "service_role";

revoke delete on table "public"."audit_logs_2026_03" from "anon";

revoke insert on table "public"."audit_logs_2026_03" from "anon";

revoke references on table "public"."audit_logs_2026_03" from "anon";

revoke select on table "public"."audit_logs_2026_03" from "anon";

revoke trigger on table "public"."audit_logs_2026_03" from "anon";

revoke truncate on table "public"."audit_logs_2026_03" from "anon";

revoke update on table "public"."audit_logs_2026_03" from "anon";

revoke references on table "public"."audit_logs_2026_03" from "authenticated";

revoke trigger on table "public"."audit_logs_2026_03" from "authenticated";

revoke truncate on table "public"."audit_logs_2026_03" from "authenticated";

revoke references on table "public"."audit_logs_2026_03" from "service_role";

revoke trigger on table "public"."audit_logs_2026_03" from "service_role";

revoke truncate on table "public"."audit_logs_2026_03" from "service_role";

revoke delete on table "public"."audit_logs_2026_04" from "anon";

revoke insert on table "public"."audit_logs_2026_04" from "anon";

revoke references on table "public"."audit_logs_2026_04" from "anon";

revoke select on table "public"."audit_logs_2026_04" from "anon";

revoke trigger on table "public"."audit_logs_2026_04" from "anon";

revoke truncate on table "public"."audit_logs_2026_04" from "anon";

revoke update on table "public"."audit_logs_2026_04" from "anon";

revoke references on table "public"."audit_logs_2026_04" from "authenticated";

revoke trigger on table "public"."audit_logs_2026_04" from "authenticated";

revoke truncate on table "public"."audit_logs_2026_04" from "authenticated";

revoke references on table "public"."audit_logs_2026_04" from "service_role";

revoke trigger on table "public"."audit_logs_2026_04" from "service_role";

revoke truncate on table "public"."audit_logs_2026_04" from "service_role";

revoke delete on table "public"."audit_logs_2026_05" from "anon";

revoke insert on table "public"."audit_logs_2026_05" from "anon";

revoke references on table "public"."audit_logs_2026_05" from "anon";

revoke select on table "public"."audit_logs_2026_05" from "anon";

revoke trigger on table "public"."audit_logs_2026_05" from "anon";

revoke truncate on table "public"."audit_logs_2026_05" from "anon";

revoke update on table "public"."audit_logs_2026_05" from "anon";

revoke references on table "public"."audit_logs_2026_05" from "authenticated";

revoke trigger on table "public"."audit_logs_2026_05" from "authenticated";

revoke truncate on table "public"."audit_logs_2026_05" from "authenticated";

revoke references on table "public"."audit_logs_2026_05" from "service_role";

revoke trigger on table "public"."audit_logs_2026_05" from "service_role";

revoke truncate on table "public"."audit_logs_2026_05" from "service_role";

revoke delete on table "public"."audit_logs_2026_06" from "anon";

revoke insert on table "public"."audit_logs_2026_06" from "anon";

revoke references on table "public"."audit_logs_2026_06" from "anon";

revoke select on table "public"."audit_logs_2026_06" from "anon";

revoke trigger on table "public"."audit_logs_2026_06" from "anon";

revoke truncate on table "public"."audit_logs_2026_06" from "anon";

revoke update on table "public"."audit_logs_2026_06" from "anon";

revoke references on table "public"."audit_logs_2026_06" from "authenticated";

revoke trigger on table "public"."audit_logs_2026_06" from "authenticated";

revoke truncate on table "public"."audit_logs_2026_06" from "authenticated";

revoke references on table "public"."audit_logs_2026_06" from "service_role";

revoke trigger on table "public"."audit_logs_2026_06" from "service_role";

revoke truncate on table "public"."audit_logs_2026_06" from "service_role";

revoke delete on table "public"."audit_logs_2026_07" from "anon";

revoke insert on table "public"."audit_logs_2026_07" from "anon";

revoke references on table "public"."audit_logs_2026_07" from "anon";

revoke select on table "public"."audit_logs_2026_07" from "anon";

revoke trigger on table "public"."audit_logs_2026_07" from "anon";

revoke truncate on table "public"."audit_logs_2026_07" from "anon";

revoke update on table "public"."audit_logs_2026_07" from "anon";

revoke references on table "public"."audit_logs_2026_07" from "authenticated";

revoke trigger on table "public"."audit_logs_2026_07" from "authenticated";

revoke truncate on table "public"."audit_logs_2026_07" from "authenticated";

revoke references on table "public"."audit_logs_2026_07" from "service_role";

revoke trigger on table "public"."audit_logs_2026_07" from "service_role";

revoke truncate on table "public"."audit_logs_2026_07" from "service_role";

revoke delete on table "public"."billing_accounts" from "anon";

revoke insert on table "public"."billing_accounts" from "anon";

revoke references on table "public"."billing_accounts" from "anon";

revoke select on table "public"."billing_accounts" from "anon";

revoke trigger on table "public"."billing_accounts" from "anon";

revoke truncate on table "public"."billing_accounts" from "anon";

revoke update on table "public"."billing_accounts" from "anon";

revoke references on table "public"."billing_accounts" from "authenticated";

revoke trigger on table "public"."billing_accounts" from "authenticated";

revoke truncate on table "public"."billing_accounts" from "authenticated";

revoke references on table "public"."billing_accounts" from "service_role";

revoke trigger on table "public"."billing_accounts" from "service_role";

revoke truncate on table "public"."billing_accounts" from "service_role";

revoke delete on table "public"."billing_logs" from "anon";

revoke insert on table "public"."billing_logs" from "anon";

revoke references on table "public"."billing_logs" from "anon";

revoke select on table "public"."billing_logs" from "anon";

revoke trigger on table "public"."billing_logs" from "anon";

revoke truncate on table "public"."billing_logs" from "anon";

revoke update on table "public"."billing_logs" from "anon";

revoke references on table "public"."billing_logs" from "authenticated";

revoke trigger on table "public"."billing_logs" from "authenticated";

revoke truncate on table "public"."billing_logs" from "authenticated";

revoke references on table "public"."billing_logs" from "service_role";

revoke trigger on table "public"."billing_logs" from "service_role";

revoke truncate on table "public"."billing_logs" from "service_role";

revoke delete on table "public"."companies" from "anon";

revoke insert on table "public"."companies" from "anon";

revoke references on table "public"."companies" from "anon";

revoke select on table "public"."companies" from "anon";

revoke trigger on table "public"."companies" from "anon";

revoke truncate on table "public"."companies" from "anon";

revoke update on table "public"."companies" from "anon";

revoke references on table "public"."companies" from "authenticated";

revoke trigger on table "public"."companies" from "authenticated";

revoke truncate on table "public"."companies" from "authenticated";

revoke references on table "public"."companies" from "service_role";

revoke trigger on table "public"."companies" from "service_role";

revoke truncate on table "public"."companies" from "service_role";

revoke delete on table "public"."company_members" from "anon";

revoke insert on table "public"."company_members" from "anon";

revoke references on table "public"."company_members" from "anon";

revoke select on table "public"."company_members" from "anon";

revoke trigger on table "public"."company_members" from "anon";

revoke truncate on table "public"."company_members" from "anon";

revoke update on table "public"."company_members" from "anon";

revoke references on table "public"."company_members" from "authenticated";

revoke trigger on table "public"."company_members" from "authenticated";

revoke truncate on table "public"."company_members" from "authenticated";

revoke references on table "public"."company_members" from "service_role";

revoke trigger on table "public"."company_members" from "service_role";

revoke truncate on table "public"."company_members" from "service_role";

revoke delete on table "public"."company_usage_metrics" from "anon";

revoke insert on table "public"."company_usage_metrics" from "anon";

revoke references on table "public"."company_usage_metrics" from "anon";

revoke select on table "public"."company_usage_metrics" from "anon";

revoke trigger on table "public"."company_usage_metrics" from "anon";

revoke truncate on table "public"."company_usage_metrics" from "anon";

revoke update on table "public"."company_usage_metrics" from "anon";

revoke references on table "public"."company_usage_metrics" from "authenticated";

revoke trigger on table "public"."company_usage_metrics" from "authenticated";

revoke truncate on table "public"."company_usage_metrics" from "authenticated";

revoke references on table "public"."company_usage_metrics" from "service_role";

revoke trigger on table "public"."company_usage_metrics" from "service_role";

revoke truncate on table "public"."company_usage_metrics" from "service_role";

revoke delete on table "public"."internal_actions_log" from "anon";

revoke insert on table "public"."internal_actions_log" from "anon";

revoke references on table "public"."internal_actions_log" from "anon";

revoke select on table "public"."internal_actions_log" from "anon";

revoke trigger on table "public"."internal_actions_log" from "anon";

revoke truncate on table "public"."internal_actions_log" from "anon";

revoke update on table "public"."internal_actions_log" from "anon";

revoke references on table "public"."internal_actions_log" from "authenticated";

revoke trigger on table "public"."internal_actions_log" from "authenticated";

revoke truncate on table "public"."internal_actions_log" from "authenticated";

revoke references on table "public"."internal_actions_log" from "service_role";

revoke trigger on table "public"."internal_actions_log" from "service_role";

revoke truncate on table "public"."internal_actions_log" from "service_role";

revoke delete on table "public"."material_batches" from "anon";

revoke insert on table "public"."material_batches" from "anon";

revoke references on table "public"."material_batches" from "anon";

revoke select on table "public"."material_batches" from "anon";

revoke trigger on table "public"."material_batches" from "anon";

revoke truncate on table "public"."material_batches" from "anon";

revoke update on table "public"."material_batches" from "anon";

revoke references on table "public"."material_batches" from "authenticated";

revoke trigger on table "public"."material_batches" from "authenticated";

revoke truncate on table "public"."material_batches" from "authenticated";

revoke references on table "public"."material_batches" from "service_role";

revoke trigger on table "public"."material_batches" from "service_role";

revoke truncate on table "public"."material_batches" from "service_role";

revoke delete on table "public"."products" from "anon";

revoke insert on table "public"."products" from "anon";

revoke references on table "public"."products" from "anon";

revoke select on table "public"."products" from "anon";

revoke trigger on table "public"."products" from "anon";

revoke truncate on table "public"."products" from "anon";

revoke update on table "public"."products" from "anon";

revoke references on table "public"."products" from "authenticated";

revoke trigger on table "public"."products" from "authenticated";

revoke truncate on table "public"."products" from "authenticated";

revoke references on table "public"."products" from "service_role";

revoke trigger on table "public"."products" from "service_role";

revoke truncate on table "public"."products" from "service_role";

revoke delete on table "public"."raw_materials" from "anon";

revoke insert on table "public"."raw_materials" from "anon";

revoke references on table "public"."raw_materials" from "anon";

revoke select on table "public"."raw_materials" from "anon";

revoke trigger on table "public"."raw_materials" from "anon";

revoke truncate on table "public"."raw_materials" from "anon";

revoke update on table "public"."raw_materials" from "anon";

revoke references on table "public"."raw_materials" from "authenticated";

revoke trigger on table "public"."raw_materials" from "authenticated";

revoke truncate on table "public"."raw_materials" from "authenticated";

revoke references on table "public"."raw_materials" from "service_role";

revoke trigger on table "public"."raw_materials" from "service_role";

revoke truncate on table "public"."raw_materials" from "service_role";

revoke delete on table "public"."stock_movements" from "anon";

revoke insert on table "public"."stock_movements" from "anon";

revoke references on table "public"."stock_movements" from "anon";

revoke select on table "public"."stock_movements" from "anon";

revoke trigger on table "public"."stock_movements" from "anon";

revoke truncate on table "public"."stock_movements" from "anon";

revoke update on table "public"."stock_movements" from "anon";

revoke references on table "public"."stock_movements" from "authenticated";

revoke trigger on table "public"."stock_movements" from "authenticated";

revoke truncate on table "public"."stock_movements" from "authenticated";

revoke references on table "public"."stock_movements" from "service_role";

revoke trigger on table "public"."stock_movements" from "service_role";

revoke truncate on table "public"."stock_movements" from "service_role";

revoke delete on table "public"."subscription_events" from "anon";

revoke insert on table "public"."subscription_events" from "anon";

revoke references on table "public"."subscription_events" from "anon";

revoke select on table "public"."subscription_events" from "anon";

revoke trigger on table "public"."subscription_events" from "anon";

revoke truncate on table "public"."subscription_events" from "anon";

revoke update on table "public"."subscription_events" from "anon";

revoke references on table "public"."subscription_events" from "authenticated";

revoke trigger on table "public"."subscription_events" from "authenticated";

revoke truncate on table "public"."subscription_events" from "authenticated";

revoke references on table "public"."subscription_events" from "service_role";

revoke trigger on table "public"."subscription_events" from "service_role";

revoke truncate on table "public"."subscription_events" from "service_role";

revoke delete on table "public"."subscription_plans" from "anon";

revoke insert on table "public"."subscription_plans" from "anon";

revoke references on table "public"."subscription_plans" from "anon";

revoke select on table "public"."subscription_plans" from "anon";

revoke trigger on table "public"."subscription_plans" from "anon";

revoke truncate on table "public"."subscription_plans" from "anon";

revoke update on table "public"."subscription_plans" from "anon";

revoke references on table "public"."subscription_plans" from "authenticated";

revoke trigger on table "public"."subscription_plans" from "authenticated";

revoke truncate on table "public"."subscription_plans" from "authenticated";

revoke references on table "public"."subscription_plans" from "service_role";

revoke trigger on table "public"."subscription_plans" from "service_role";

revoke truncate on table "public"."subscription_plans" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke references on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

CREATE TRIGGER trg_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


