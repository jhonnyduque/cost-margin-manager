-- ============================================================================
-- FASE 0: AUTH HELPER FUNCTIONS
-- ============================================================================
-- Funciones reutilizables para RLS policies
-- ============================================================================

-- ============================================================================
-- FUNCIÓN 1: public.user_id()
-- ============================================================================
-- Extrae el user_id del JWT actual
CREATE OR REPLACE FUNCTION public.user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'sub',
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN 2: public.is_super_admin()
-- ============================================================================
-- Verifica si el usuario actual es super admin global
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM users WHERE id = public.user_id()),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN 3: public.user_companies()
-- ============================================================================
-- Retorna todas las companies donde el usuario es member activo
CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID AS $$
  SELECT company_id 
  FROM company_members
  WHERE user_id = public.user_id() 
    AND is_active = true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN 4: public.user_role_in_company(company_id UUID)
-- ============================================================================
-- Obtiene el rol del usuario en una company específica
CREATE OR REPLACE FUNCTION public.user_role_in_company(cid UUID)
RETURNS TEXT AS $$
  SELECT role 
  FROM company_members
  WHERE company_id = cid 
    AND user_id = public.user_id() 
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN 5: public.has_role_level(company_id UUID, min_role TEXT)
-- ============================================================================
-- Verifica si el usuario tiene el nivel mínimo de rol requerido
CREATE OR REPLACE FUNCTION public.has_role_level(cid UUID, min_role TEXT)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN 6: public.company_subscription_status(company_id UUID)
-- ============================================================================
-- Obtiene el subscription_status de una company
CREATE OR REPLACE FUNCTION public.company_subscription_status(cid UUID)
RETURNS TEXT AS $$
  SELECT subscription_status 
  FROM companies 
  WHERE id = cid AND deleted_at IS NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Verificación
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000002_phase0_auth_helpers.sql completed';
  RAISE NOTICE 'Helper functions created: public.user_id, public.is_super_admin, public.user_companies, public.user_role_in_company, public.has_role_level, public.company_subscription_status';
END $$;
