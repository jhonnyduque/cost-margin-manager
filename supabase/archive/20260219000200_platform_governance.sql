-- ============================================================================
-- MODELO BETO: PLATFORM GOVERNANCE
-- ============================================================================

-- 1. TABLA DE AUDITORÍA DE PLATAFORMA
CREATE TABLE IF NOT EXISTS public.platform_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_company_id UUID REFERENCES public.companies(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- Solo BETO puede ver logs de plataforma
CREATE POLICY platform_events_select ON public.platform_events
    FOR SELECT USING (public.is_super_admin());

-- 2. SOFT DELETE PARA COMPANIES
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. SEGURIDAD REDUNDANTE PARA SUPER ADMIN
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- Sincronizar is_platform_admin con los casos existentes (si los hay)
-- Nota: Esto es un "hard-flag" en DB que complementa al JWT claim
UPDATE public.users 
SET is_platform_admin = true 
WHERE id IN (
    SELECT id FROM public.users WHERE is_super_admin = true
);

-- 4. REFINAMIENTO DE RLS - CONTROL DE ESTADO (SUSPENDED / DELETED)
-- Modificamos las funciones helper para que propaguen el bloqueo de estado.

-- Función para verificar si una empresa está operativa (helper interno)
CREATE OR REPLACE FUNCTION public.is_company_active(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = cid 
      AND subscription_status IN ('active', 'trialing') 
      AND deleted_at IS NULL
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Actualizamos public.user_companies()
CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID AS $$
  SELECT cm.company_id 
  FROM company_members cm
  JOIN companies c ON c.id = cm.company_id
  WHERE cm.user_id = public.user_id() 
    AND cm.is_active = true
    AND c.subscription_status IN ('active', 'trialing')
    AND c.deleted_at IS NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Actualizamos public.user_role_in_company()
CREATE OR REPLACE FUNCTION public.user_role_in_company(cid UUID)
RETURNS TEXT AS $$
  SELECT cm.role 
  FROM company_members cm
  JOIN companies c ON c.id = cm.company_id
  WHERE cm.company_id = cid 
    AND cm.user_id = public.user_id() 
    AND cm.is_active = true
    AND c.subscription_status IN ('active', 'trialing')
    AND c.deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Actualizamos policies de empresas para filtrar borrados y suspendidos (para tenants)
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT USING (
    public.is_super_admin() OR (
      id IN (SELECT public.user_companies())
    )
  );

-- 5. TRIGGER DE AUDITORÍA PARA PROVISIÓN
-- Automatizamos el registro de creación de empresas en platform_events
CREATE OR REPLACE FUNCTION public.log_platform_provisioning()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.platform_events (actor_user_id, action, target_company_id, metadata)
    VALUES (
        public.user_id(),
        'COMPANY_CREATED',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'slug', NEW.slug)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_company_creation ON public.companies;
CREATE TRIGGER trg_log_company_creation
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.log_platform_provisioning();
