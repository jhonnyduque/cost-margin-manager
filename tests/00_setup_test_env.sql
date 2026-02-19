-- ============================================================================
-- AUDITORÍA Y CORRECCIÓN: INIT TEST ENVIRONMENT (MASTER SCRIPT)
-- ============================================================================
-- Descripción: Este script garantiza que el entorno de pruebas tenga los datos
-- base necesarios (Company A, Owner) para que los tests de límites funcionen.
-- Ejecutar este script ANTES de 'limits_test.sql' si hay errores de FK.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  comp_id UUID := '11111111-1111-1111-1111-111111111111';
  owner_id UUID := 'aaaa1111-1111-1111-1111-111111111111';
BEGIN
  RAISE NOTICE '--- 1. CLEANUP (Removing old test data) ---';
  -- Limpiar tablas en orden inverso de dependencia
  DELETE FROM company_members WHERE company_id = comp_id;
  DELETE FROM products WHERE company_id = comp_id;
  DELETE FROM companies WHERE id = comp_id;
  DELETE FROM public.users WHERE id = owner_id;
  -- Nota: No borramos de auth.users porque requiere permisos especiales o no es necesario si usamos ON CONFLICT

  RAISE NOTICE '--- 2. SETUP AUTH USERS (Mock) ---';
  INSERT INTO auth.users (id, email) VALUES (owner_id, 'owner@test.com') ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '--- 3. SETUP COMPANY ---';
  INSERT INTO companies (id, slug, name, subscription_status, subscription_tier)
  VALUES (comp_id, 'company-a', 'Company A', 'active', 'starter')
  ON CONFLICT (id) DO UPDATE 
  SET subscription_status = 'active', subscription_tier = 'starter';

  RAISE NOTICE '--- 4. SETUP PUBLIC USER & MEMBER ---';
  INSERT INTO public.users (id, email, full_name, default_company_id)
  VALUES (owner_id, 'owner@test.com', 'Owner User', comp_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO company_members (company_id, user_id, role)
  VALUES (comp_id, owner_id, 'owner')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ ENVIRONMENT READY FOR TESTING';
END $$;

COMMIT;
