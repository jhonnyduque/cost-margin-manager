-- ============================================================================
-- TEST DE AISLAMIENTO (ISOLATION TEST) - V5 (FIX TRIGGER CONFLICT)
-- ============================================================================
-- Instrucciones:
-- 1. Ejecuta este script COMPLETO en Supabase SQL Editor.
-- 2. Debe terminar con "ALL TESTS COMPLETED SUCCESSFULLY".
-- ============================================================================

BEGIN;

-- 0. CLEANUP PREVIO
-- Limpiamos todo para asegurar estado inicial
DELETE FROM stock_movements WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM material_batches WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM raw_materials WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM products WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM company_members WHERE company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- Borrar public users primero
DELETE FROM public.users WHERE id IN ('aaaa1111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222');
-- Borrar companies
DELETE FROM companies WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- Finalmente borrar auth users (si es posible, triggers cascade deberían manejarlo pero por seguridad)
DELETE FROM auth.users WHERE id IN ('aaaa1111-1111-1111-1111-111111111111', 'bbbb2222-2222-2222-2222-222222222222');


-- 1. SETUP: Crear 2 Companies de prueba
INSERT INTO companies (id, slug, name, subscription_status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'company-a', 'Company A', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'company-b', 'Company B', 'active');

-- 2. SETUP: Crear Usuarios Dummy
-- Insertar en auth.users dispara trigger 'on_auth_user_created' que crea el row en public.users automáticamente.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES 
  ('aaaa1111-1111-1111-1111-111111111111', 'user.a@test.com', '{"full_name": "User A"}'),
  ('bbbb2222-2222-2222-2222-222222222222', 'user.b@test.com', '{"full_name": "User B"}');

-- ACTUALIZAR public.users (creado por trigger) con los datos extra que necesitamos (default_company_id)
-- Usamos UPDATE en vez de INSERT para evitar violar la PK duplicada.
UPDATE public.users 
SET default_company_id = '11111111-1111-1111-1111-111111111111'
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';

UPDATE public.users 
SET default_company_id = '22222222-2222-2222-2222-222222222222'
WHERE id = 'bbbb2222-2222-2222-2222-222222222222';


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
-- TEST 1: Verificar Aislamiento - COMO USER B
-- ============================================================================
SET ROLE authenticated;

-- Simular sesión de User B
SET request.jwt.claims = '{"sub": "bbbb2222-2222-2222-2222-222222222222", "role": "authenticated"}';
SET request.jwt.claim.sub = 'bbbb2222-2222-2222-2222-222222222222';

DO $$
DECLARE
  count_visible INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_visible 
  FROM products 
  WHERE company_id = '11111111-1111-1111-1111-111111111111';
  
  IF count_visible = 0 THEN
    RAISE NOTICE '✅ TEST 1 PASSED: User B cannot see products from Company A';
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED: User B saw % products from Company A', count_visible;
  END IF;
END $$;

-- ============================================================================
-- TEST 2: Verificar Acceso Propio - COMO USER A
-- ============================================================================
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

ROLLBACK;
