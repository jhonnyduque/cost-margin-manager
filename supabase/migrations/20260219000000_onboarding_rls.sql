-- ============================================================================
-- ONBOARDING ATOMICITY & RLS (Single-Tenant Protection)
-- ============================================================================

-- 1. Función RPC para creación ATÓMICA de Empresa + Owner
-- Esta función garantiza que no existan empresas huérfanas.
CREATE OR REPLACE FUNCTION public.create_company_with_owner(
  company_name TEXT,
  company_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta como owner (postgres) para garantizar atomicidad bypassando RLS interno si es necesario
SET search_path = public, extensions -- Hardened search_path para evitar ataques de búsqueda
AS $$
DECLARE
  new_company_id UUID;
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  -- A. Validación de Sesión (Garantía de rol authenticated)
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- B. Validación Single-Tenant: No puede tener membresías previas de ningún tipo
  IF EXISTS (SELECT 1 FROM company_members WHERE user_id = current_user_id) THEN
    RAISE EXCEPTION 'El usuario ya pertenece a una empresa.';
  END IF;

  -- C. Inserción de Empresa (Activará el UNIQUE INDEX físico en slug)
  INSERT INTO companies (name, slug, subscription_status, subscription_tier)
  VALUES (company_name, company_slug, 'trialing', 'starter')
  RETURNING id INTO new_company_id;

  -- D. Inserción de Membresía (Owner)
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (new_company_id, current_user_id, 'owner');

  -- E. Actualización de Usuario
  UPDATE users
  SET default_company_id = new_company_id
  WHERE id = current_user_id;

  -- F. Construir Respuesta
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug
  ) INTO result
  FROM companies
  WHERE id = new_company_id;

  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- PostgreSQL garantiza ROLLBACK total en excepciones de funciones plpgsql
  RAISE;
END;
$$;

-- 2. Control de Ejecución (Security Hardening)
REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(TEXT, TEXT) TO service_role;

-- 3. Políticas RLS (Segunda capa de defensa para inserciones directas)
CREATE POLICY companies_onboarding_insert ON companies
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    NOT EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY membership_onboarding_insert ON company_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND 
    role = 'owner' AND
    NOT EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid())
  );

COMMIT;
