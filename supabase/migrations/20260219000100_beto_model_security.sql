-- ============================================================================
-- MODELO BETO: LOCKDOWN & PROVISIONING RULES
-- ============================================================================

-- 1. ELIMINAR ONBOARDING AUTOMÁTICO ANTERIOR
DROP TRIGGER IF EXISTS trg_user_onboarding ON public.users;
DROP FUNCTION IF EXISTS public.handle_new_user_onboarding();

-- 2. HARDENING RLS: companies
-- Solo BETO (is_super_admin) puede modificar empresas.
-- Los tenants solo pueden ver la suya.
DROP POLICY IF EXISTS companies_insert ON public.companies;
DROP POLICY IF EXISTS companies_update ON public.companies;
DROP POLICY IF EXISTS companies_delete ON public.companies;

CREATE POLICY companies_insert ON public.companies
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY companies_update ON public.companies
  FOR UPDATE USING (public.is_super_admin());

CREATE POLICY companies_delete ON public.companies
  FOR DELETE USING (public.is_super_admin());

-- 3. LIMITACIÓN DE USUARIOS (Max 3 por Company)
CREATE OR REPLACE FUNCTION public.check_company_user_limit()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_limit_company_users ON public.company_members;
CREATE TRIGGER trg_limit_company_users
  BEFORE INSERT ON public.company_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_company_user_limit();

-- 4. HELPER DE PROVISIÓN PARA BETO (SQL DEFINER)
-- Esta función facilita a BETO crear el perfil y la membresía de una vez.
-- El usuario auth debe ser creado previamente por la Admin API de Supabase.
CREATE OR REPLACE FUNCTION public.beto_provision_tenant(
    p_company_name TEXT,
    p_company_slug TEXT,
    p_user_id UUID,
    p_user_role TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- E. AUDITORÍA: Registrar el evento de provisión (BETO Audit)
    INSERT INTO public.platform_events (actor_user_id, action, target_company_id, metadata)
    VALUES (
        public.user_id(),
        'TENANT_PROVISIONED',
        v_company_id,
        jsonb_build_object(
            'admin_email', (SELECT email FROM auth.users WHERE id = p_user_id),
            'company_name', p_company_name,
            'provision_type', 'SQL_HELPER'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'company_id', v_company_id,
        'message', 'Tenant provisioned successfully'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.beto_provision_tenant(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.beto_provision_tenant(TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.beto_provision_tenant(TEXT, TEXT, UUID, TEXT) TO service_role;
