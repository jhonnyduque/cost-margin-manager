-- ============================================================================
-- MODELO BETO: BILLING & LIFECYCLE GOVERNANCE
-- ============================================================================

-- 1. TABLA DE CUENTAS DE FACTURACIÓN
CREATE TABLE IF NOT EXISTS public.billing_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan_tier TEXT DEFAULT 'starter', -- 'starter', 'premium', 'enterprise'
    billing_status TEXT DEFAULT 'trialing', -- 'active', 'past_due', 'unpaid', 'canceled'
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Solo BETO puede ver cuentas de facturación
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS billing_accounts_all ON public.billing_accounts;
    CREATE POLICY billing_accounts_all ON public.billing_accounts
        FOR ALL USING (public.is_super_admin());
END $$;

-- 2. TRIGGER PARA CREAR BILLING ACCOUNT AUTOMÁTICAMENTE
-- Cuando BETO crea una empresa, se pre-genera su registro de billing
CREATE OR REPLACE FUNCTION public.handle_company_billing_init()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.billing_accounts (company_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_company_billing ON public.companies;
CREATE TRIGGER trg_init_company_billing
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_company_billing_init();

-- 3. LÓGICA DE GRACE PERIOD (ESTADO EXPIRACIÓN)
-- Función para determinar si el acceso debe ser bloqueado por ciclo de vida
CREATE OR REPLACE FUNCTION public.is_within_grace_period(p_company_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. VISTA DE MÉTRICAS PARA EL DASHBOARD BETO
CREATE OR REPLACE VIEW public.platform_metrics AS
SELECT
    COUNT(*) as total_tenants,
    COUNT(*) FILTER (WHERE subscription_status = 'active') as active_tenants,
    COUNT(*) FILTER (WHERE subscription_status = 'suspended') as suspended_tenants,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_tenants,
    -- Estimación simple de MRR (asumiendo precios fijos base)
    SUM(
        CASE 
            WHEN subscription_status = 'active' AND subscription_tier = 'premium' THEN 49.00
            WHEN subscription_status = 'active' AND subscription_tier = 'enterprise' THEN 149.00
            ELSE 0 
        END
    ) as mrr_estimate
FROM public.companies
WHERE deleted_at IS NULL;

-- Dar permiso a BETO para leer la vista
GRANT SELECT ON public.platform_metrics TO authenticated;
GRANT SELECT ON public.platform_metrics TO service_role;
