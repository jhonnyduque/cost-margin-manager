-- ============================================================================
-- FASE 1: RECREATE EVENTS TABLE (CLEAN SLATE) - FIXED
-- ============================================================================
-- Descripción: La tabla subscription_events tiene un esquema inconsistente 
-- debido a versiones previas. Vamos a recrearla desde cero para garantizar
-- que tenga todas las columnas necesarias (payload, status, etc.).
-- ============================================================================

-- 1. Eliminar tabla corrupta/incompleta
DROP TABLE IF EXISTS subscription_events CASCADE;

-- 2. Crear tabla con schema correcto FASE 1
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL, 
  stripe_event_id TEXT UNIQUE NOT NULL,    
  event_type TEXT NOT NULL,                 
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,                   
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 3. Habilitar RLS
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- 4. Crear Policies
CREATE POLICY subscription_events_select ON subscription_events FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );

CREATE POLICY subscription_events_deny_write ON subscription_events FOR INSERT WITH CHECK (false);
CREATE POLICY subscription_events_deny_update ON subscription_events FOR UPDATE USING (false);

-- 5. Grant permissions
GRANT SELECT ON subscription_events TO authenticated;
GRANT SELECT ON subscription_events TO service_role;
GRANT INSERT, UPDATE ON subscription_events TO service_role; 

DO $$
BEGIN
  RAISE NOTICE 'Recreated subscription_events table successfully';
END $$;
