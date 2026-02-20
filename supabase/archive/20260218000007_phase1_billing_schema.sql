-- ============================================================================
-- FASE 1: BILLING SCHEMA & LOGIC (FIXED IDEMPOTENCY)
-- ============================================================================
-- Descripción: Implementa tablas de eventos de facturación, logs de auditoría,
-- columnas de período en companies, y función de nivel de suspensión.
-- Autor: Sistema
-- Fecha: 2026-02-18
-- ============================================================================

-- 1. Modificar tabla COMPANIES con columnas de período y cancelación
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Índices (Idempotentes)
CREATE INDEX IF NOT EXISTS idx_companies_stripe_sub_id ON companies(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_companies_period_end ON companies(current_period_ends_at);

-- ============================================================================
-- 2. Tabla: subscription_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL, 
  stripe_event_id TEXT UNIQUE NOT NULL,    
  event_type TEXT NOT NULL,                 
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  payload JSONB NOT NULL,                   
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Limpiar policies previas para evitar conflicto (FIX 42710)
DROP POLICY IF EXISTS subscription_events_select ON subscription_events;
DROP POLICY IF EXISTS subscription_events_deny_write ON subscription_events;
DROP POLICY IF EXISTS subscription_events_deny_update ON subscription_events;

-- Re-crear Policies
CREATE POLICY subscription_events_select ON subscription_events FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );

CREATE POLICY subscription_events_deny_write ON subscription_events FOR INSERT WITH CHECK (false);
CREATE POLICY subscription_events_deny_update ON subscription_events FOR UPDATE USING (false);


-- ============================================================================
-- 3. Tabla: billing_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,      
  previous_status TEXT,           
  new_status TEXT,                
  reason TEXT,                    
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;

-- Limpiar policies previas
DROP POLICY IF EXISTS billing_logs_select ON billing_logs;

-- Re-crear Policy
CREATE POLICY billing_logs_select ON billing_logs FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );


-- ============================================================================
-- 4. Función: get_suspension_level (STABLE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_suspension_level(
  status TEXT,
  grace_period_ends_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. Helper wrapper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_company_suspension_level(cid UUID)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================================
-- 6. Grants
-- ============================================================================
GRANT SELECT ON subscription_events TO authenticated;
GRANT SELECT ON billing_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_suspension_level TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_suspension_level TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000007_phase1_billing_schema.sql completed (Idempotent Apply)';
END $$;
