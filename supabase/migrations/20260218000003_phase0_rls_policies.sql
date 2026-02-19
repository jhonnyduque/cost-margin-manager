-- ============================================================================
-- FASE 0: ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Habilita RLS y crea policies para todas las tablas core
-- ============================================================================

-- ============================================================================
-- TABLA: companies
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- SELECT: Ver solo companies donde el user es member (o super admin)
CREATE POLICY companies_select ON companies FOR SELECT
  USING (
    public.is_super_admin() OR
    (id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

-- INSERT: Solo super admins pueden crear directamente
-- (signup flow creará via trigger)
CREATE POLICY companies_insert ON companies FOR INSERT
  WITH CHECK (public.is_super_admin());

-- UPDATE: Solo owners de la company
CREATE POLICY companies_update ON companies FOR UPDATE
  USING (
    public.is_super_admin() OR
    public.has_role_level(id, 'owner')
  );

-- DELETE (soft): Solo owners
CREATE POLICY companies_delete ON companies FOR DELETE
  USING (
    public.is_super_admin() OR
    public.has_role_level(id, 'owner')
  );

-- ============================================================================
-- TABLA: users
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT: Ver solo users de las mismas companies (o super admin)
CREATE POLICY users_select ON users FOR SELECT
  USING (
    public.is_super_admin() OR
    id = public.user_id() OR
    id IN (
      SELECT user_id FROM company_members
      WHERE company_id IN (SELECT public.user_companies())
    )
  );

-- INSERT: Solo al crear su propio perfil
CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (id = public.user_id());

-- UPDATE: Solo su propio perfil (o super admin)
CREATE POLICY users_update ON users FOR UPDATE
  USING (
    public.is_super_admin() OR
    id = public.user_id()
  );

-- ============================================================================
-- TABLA: company_members
-- ============================================================================
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- SELECT: Ver members de sus companies
CREATE POLICY company_members_select ON company_members FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );

-- INSERT: Admins y superiores pueden invitar
CREATE POLICY company_members_insert ON company_members FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR
    public.has_role_level(company_id, 'admin')
  );

-- UPDATE: Admins y superiores pueden cambiar roles
-- (con validación adicional en trigger)
CREATE POLICY company_members_update ON company_members FOR UPDATE
  USING (
    public.is_super_admin() OR
    public.has_role_level(company_id, 'admin')
  );

-- DELETE: Admins y superiores pueden remover
-- (trigger previene eliminar último owner)
CREATE POLICY company_members_delete ON company_members FOR DELETE
  USING (
    public.is_super_admin() OR
    public.has_role_level(company_id, 'admin')
  );

-- ============================================================================
-- TABLA: subscription_plans (READ-ONLY para todos)
-- ============================================================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: Todos pueden ver planes
CREATE POLICY subscription_plans_select ON subscription_plans FOR SELECT
  USING (true);

-- Resto de operaciones: Solo super admin
CREATE POLICY subscription_plans_modify ON subscription_plans FOR ALL
  USING (public.is_super_admin());

-- ============================================================================
-- TABLA: audit_logs (IMMUTABLE - No UPDATE/DELETE)
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Ver logs de sus companies
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );

-- INSERT: Sistema puede insertar
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true);

-- UPDATE: BLOQUEADO (audit logs son immutables)
CREATE POLICY audit_logs_no_update ON audit_logs FOR UPDATE
  USING (false);

-- DELETE: Solo super admin después de 90 días (compliance purge)
CREATE POLICY audit_logs_limited_delete ON audit_logs FOR DELETE
  USING (
    public.is_super_admin() AND 
    created_at < NOW() - INTERVAL '90 days'
  );

-- ============================================================================
-- TABLA: subscription_events
-- ============================================================================
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_events_select ON subscription_events FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );

-- ============================================================================
-- TABLA: internal_actions_log
-- ============================================================================
ALTER TABLE internal_actions_log ENABLE ROW LEVEL SECURITY;

-- Solo super admins pueden ver/modificar
CREATE POLICY internal_actions_all ON internal_actions_log FOR ALL
  USING (public.is_super_admin());

-- ============================================================================
-- TABLA: company_usage_metrics
-- ============================================================================
ALTER TABLE company_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_metrics_select ON company_usage_metrics FOR SELECT
  USING (
    public.is_super_admin() OR
    company_id IN (SELECT public.user_companies())
  );

-- Verificación final
DO $$
DECLARE
  rls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_class
  WHERE relrowsecurity = true;
  
  RAISE NOTICE 'Migration 20260218000003_phase0_rls_policies.sql completed';
  RAISE NOTICE 'Tables with RLS enabled: %', rls_count;
  
  IF rls_count < 8 THEN
    RAISE WARNING 'Expected at least 8 tables with RLS enabled, found: %', rls_count;
  END IF;
END $$;
