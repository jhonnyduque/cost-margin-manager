-- ============================================================================
-- FASE 3: PLAN AWARENESS & PUBLIC ACCESS
-- ============================================================================

-- 1. Habilitar RLS en subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Permitir lectura a todos los usuarios autenticados
-- (Necesario para que el Frontend sepa los límites del plan actual)
CREATE POLICY "authenticated_can_read_plans"
ON subscription_plans
FOR SELECT
TO authenticated
USING (true);

-- 3. Policy: Permitir lectura pública (opcional, para landing page pricing)
CREATE POLICY "anon_can_read_plans"
ON subscription_plans
FOR SELECT
TO anon
USING (true);

-- 4. Asegurar que realtime funciona para company_members (para el hook)
ALTER PUBLICATION supabase_realtime ADD TABLE company_members;
