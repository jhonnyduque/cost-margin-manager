-- ============================================================================
-- FASE 0: AUTH HELPER FUNCTIONS (SAFE VERSION)
-- ============================================================================

SET search_path = public;

-- ============================================================================
-- FUNCIÓN 1: user_id()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT COALESCE(
  nullif(current_setting('request.jwt.claims', true), '')::json->>'sub',
  nullif(current_setting('request.jwt.claim.sub', true), '')
)::UUID;
$$;

-- ============================================================================
-- FUNCIÓN 2: is_super_admin()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT COALESCE(
  (SELECT is_super_admin FROM public.users WHERE id = public.user_id()),
  false
);
$$;

-- ============================================================================
-- FUNCIÓN 3: user_companies()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_companies()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT company_id
FROM public.company_members
WHERE user_id = public.user_id()
AND is_active = true;
$$;

-- ============================================================================
-- FUNCIÓN 4: user_role_in_company()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_role_in_company(cid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT role
FROM public.company_members
WHERE company_id = cid
AND user_id = public.user_id()
AND is_active = true
LIMIT 1;
$$;

-- ============================================================================
-- FUNCIÓN 5: has_role_level()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_role_level(cid UUID, min_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_hierarchy TEXT[] := ARRAY['viewer','operator','manager','admin','owner'];
  user_role TEXT;
  user_level INT;
  required_level INT;
BEGIN

  user_role := public.user_role_in_company(cid);

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  user_level := array_position(role_hierarchy, user_role);
  required_level := array_position(role_hierarchy, min_role);

  RETURN user_level >= required_level;
END;
$$;

-- ============================================================================
-- FUNCIÓN 6: company_subscription_status()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.company_subscription_status(cid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT subscription_status
FROM public.companies
WHERE id = cid
AND deleted_at IS NULL;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Auth helpers installed successfully';
END $$;