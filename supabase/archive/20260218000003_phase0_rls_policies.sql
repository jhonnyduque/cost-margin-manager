-- ============================================================================
-- FASE 0: ROW LEVEL SECURITY POLICIES (SAFE VERSION)
-- ============================================================================

SET search_path = public;

-- ============================================================================
-- COMPANIES
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies
FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = companies.id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);

DROP POLICY IF EXISTS companies_insert ON companies;
CREATE POLICY companies_insert ON companies
FOR INSERT
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_role_level(id,'owner')
);

DROP POLICY IF EXISTS companies_delete ON companies;
CREATE POLICY companies_delete ON companies
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_role_level(id,'owner')
);

-- ============================================================================
-- USERS
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
FOR SELECT
USING (
  public.is_super_admin()
  OR id = public.user_id()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.user_id = users.id
      AND cm.company_id IN (
          SELECT company_id
          FROM public.company_members
          WHERE user_id = public.user_id()
          AND is_active = true
      )
  )
);

DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users
FOR INSERT
WITH CHECK (id = public.user_id());

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users
FOR UPDATE
USING (
  public.is_super_admin()
  OR id = public.user_id()
);

-- ============================================================================
-- COMPANY MEMBERS
-- ============================================================================
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_members_select ON company_members;
CREATE POLICY company_members_select ON company_members
FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);

DROP POLICY IF EXISTS company_members_insert ON company_members;
CREATE POLICY company_members_insert ON company_members
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR public.has_role_level(company_id,'admin')
);

DROP POLICY IF EXISTS company_members_update ON company_members;
CREATE POLICY company_members_update ON company_members
FOR UPDATE
USING (
  public.is_super_admin()
  OR public.has_role_level(company_id,'admin')
);

DROP POLICY IF EXISTS company_members_delete ON company_members;
CREATE POLICY company_members_delete ON company_members
FOR DELETE
USING (
  public.is_super_admin()
  OR public.has_role_level(company_id,'admin')
);

-- ============================================================================
-- SUBSCRIPTION PLANS
-- ============================================================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_select ON subscription_plans;
CREATE POLICY subscription_plans_select ON subscription_plans
FOR SELECT USING (true);

DROP POLICY IF EXISTS subscription_plans_modify ON subscription_plans;
CREATE POLICY subscription_plans_modify ON subscription_plans
FOR ALL USING (public.is_super_admin());

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs
FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = audit_logs.company_id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);

DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_no_update ON audit_logs;
CREATE POLICY audit_logs_no_update ON audit_logs
FOR UPDATE USING (false);

DROP POLICY IF EXISTS audit_logs_limited_delete ON audit_logs;
CREATE POLICY audit_logs_limited_delete ON audit_logs
FOR DELETE
USING (
  public.is_super_admin()
  AND created_at < NOW() - INTERVAL '90 days'
);

-- ============================================================================
-- SUBSCRIPTION EVENTS
-- ============================================================================
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_events_select ON subscription_events;
CREATE POLICY subscription_events_select ON subscription_events
FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = subscription_events.company_id
      AND cm.user_id = public.user_id()
  )
);

-- ============================================================================
-- INTERNAL ACTIONS LOG
-- ============================================================================
ALTER TABLE internal_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_actions_all ON internal_actions_log;
CREATE POLICY internal_actions_all ON internal_actions_log
FOR ALL USING (public.is_super_admin());

-- ============================================================================
-- USAGE METRICS
-- ============================================================================
ALTER TABLE company_usage_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_metrics_select ON company_usage_metrics;
CREATE POLICY usage_metrics_select ON company_usage_metrics
FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = company_usage_metrics.company_id
      AND cm.user_id = public.user_id()
  )
);

DO $$
BEGIN
  RAISE NOTICE 'RLS POLICIES INSTALLED SAFELY';
END $$;