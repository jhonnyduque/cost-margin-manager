-- ============================================================================
-- TEST DE AISLAMIENTO (ISOLATION TEST) - V4 (FINAL & ROBUSTO)
-- ============================================================================
-- Instrucciones:
-- 1. Ejecuta este script COMPLETO en Supabase SQL Editor.
-- 2. Debe terminar con "ALL TESTS COMPLETED SUCCESSFULLY" y "ROLLBACK".
-- ============================================================================

BEGIN;

-- 0. CLEANUP PREVIO (Para evitar errores de duplicados)
-- Borramos en orden inverso de dependencias
-- Nota: product_materials no existe como tabla, es JSONB en products.
DELETE FROM stock_movements WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM material_batches WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM raw_materials WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM products WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

DELETE FROM company_members WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM users WHERE id IN ('aaaa1111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222');
DELETE FROM auth.users WHERE id IN ('aaaa1111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222');
DELETE FROM companies WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');


-- 1. SETUP: Crear 2 Companies de prueba
INSERT INTO companies (id, slug, name, subscription_status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'company-a', 'Company A', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'company-b', 'Company B', 'active');

-- 2. SETUP: Crear Usuarios Dummy
INSERT INTO auth.users (id, email)
VALUES 
  ('aaaa1111-1111-1111-1111-111111111111', 'user.a@test.com'),
  ('bbbb2222-2222-2222-2222-222222222222', 'user.b@test.com');

INSERT INTO public.users (id, email, full_name, default_company_id)
VALUES 
  ('aaaa1111-1111-1111-1111-111111111111', 'user.a@test.com', 'User A', '11111111-1111-1111-1111-111111111111'),
  ('bbbb2222-2222-2222-2222-222222222222', 'user.b@test.com', 'User B', '22222222-2222-2222-2222-222222222222');

-- 3. SETUP: Membresías
INSERT INTO company_members (company_id, user_id, role)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'viewer');

-- 4. SETUP: Datos en Company A
INSERT INTO products (company_id, name, price, status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Producto Secreto A', 100, 'activa');

-- ============================================================================
-- TEST 1: Verificar Aislamiento (Cross-Tenant Access) - COMO USER B
-- ============================================================================

-- Force authorized role
SET ROLE authenticated;

-- Simular sesión de User B
SET request.jwt.claims = '{"sub": "bbbb2222-2222-2222-2222-222222222222", "role": "authenticated"}';
SET request.jwt.claim.sub = 'bbbb2222-2222-2222-2222-222222222222';

DO $$
DECLARE
  count_visible INTEGER;
  curr_user UUID;
BEGIN
  curr_user := public.user_id();
  -- Intentar leer products de Company A
  SELECT COUNT(*) INTO count_visible 
  FROM products 
  WHERE company_id = '11111111-1111-1111-1111-111111111111';
  
  IF count_visible = 0 THEN
    RAISE NOTICE '✅ TEST 1 PASSED: User B (Company B) cannot see Company A products';
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED: Data Leak! User B saw % products from Company A. Current User: %', count_visible, curr_user;
  END IF;
END $$;

-- ============================================================================
-- TEST 2: Verificar Acceso Propio - COMO USER A
-- ============================================================================

-- Simular sesión de User A
SET request.jwt.claims = '{"sub": "aaaa1111-1111-1111-1111-111111111111", "role": "authenticated"}';
SET request.jwt.claim.sub = 'aaaa1111-1111-1111-1111-111111111111';

DO $$
DECLARE
  count_visible INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_visible 
  FROM products
  WHERE company_id = '11111111-1111-1111-1111-111111111111';
  
  IF count_visible > 0 THEN
    RAISE NOTICE '✅ TEST 2 PASSED: User A can see their own products';
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED: User A cannot see their own products';
  END IF;
END $$;

-- ============================================================================
-- CLEANUP FINAL
-- ============================================================================
ROLLBACK;
