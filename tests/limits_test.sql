-- ============================================================================
-- TEST DE LIMITES Y ENFORCEMENT (FASE 2) - FINAL STABLE
-- ============================================================================
-- REQUIERE: Ejecutar primero 'tests/00_setup_test_env.sql'
-- ============================================================================

BEGIN;

-- 1. TEST: KILL SWITCH (Bloqueo por Suspensión)
DO $$
DECLARE
  company_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  RAISE NOTICE '--- TEST 1: Kill Switch (Suspended Company) ---';

  -- A. Suspender la company
  UPDATE companies SET subscription_status = 'suspended' WHERE id = company_id;

  -- B. Intentar insertar un producto (DEBE FALLAR)
  BEGIN
    INSERT INTO products (company_id, name, price, status)
    VALUES (company_id, 'Forbidden Product', 999, 'activa');
    
    RAISE EXCEPTION '❌ TEST 1 FAILED: Trigger did not block write on suspended company.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Action blocked%' THEN
      RAISE NOTICE '✅ TEST 1 PASSED: Write blocked successfully';
    ELSE
      RAISE EXCEPTION '❌ TEST 1 FAILED: Unexpected error message: %', SQLERRM;
    END IF;
  END;

  -- Restaurar status active
  UPDATE companies SET subscription_status = 'active' WHERE id = company_id;
END $$;


-- 2. TEST: ATOMIC USER LIMITS
DO $$
DECLARE
  company_id UUID := '11111111-1111-1111-1111-111111111111';
  user2_id UUID := '00000000-0000-0000-0000-000000000002';
  user3_id UUID := '00000000-0000-0000-0000-000000000003';
  user4_id UUID := '00000000-0000-0000-0000-000000000004';
BEGIN
  RAISE NOTICE '--- TEST 2: User Limits (Starter Plan = 3 Users) ---';

  -- Asegurar que company existe (Redundancia por seguridad)
  PERFORM 1 FROM companies WHERE id = company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Company not found!'; END IF;

  -- A. Crear Dummy Users Auth (Requisito FK)
  INSERT INTO auth.users (id, email) VALUES (user2_id, 'u2@test.com') ON CONFLICT DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (user3_id, 'u3@test.com') ON CONFLICT DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (user4_id, 'u4@test.com') ON CONFLICT DO NOTHING;

  -- B. Insertar User #2 (OK)
  INSERT INTO public.users (id, email) VALUES (user2_id, 'u2@test.com') ON CONFLICT DO NOTHING;
  INSERT INTO company_members (company_id, user_id, role) VALUES (company_id, user2_id, 'viewer') ON CONFLICT DO NOTHING;
  RAISE NOTICE 'User 2 added (Total: 2)';

  -- C. Insertar User #3 (OK - Límite alcanzado)
  INSERT INTO public.users (id, email) VALUES (user3_id, 'u3@test.com') ON CONFLICT DO NOTHING;
  INSERT INTO company_members (company_id, user_id, role) VALUES (company_id, user3_id, 'viewer') ON CONFLICT DO NOTHING;
  RAISE NOTICE 'User 3 added (Total: 3 - MAX)';

  -- D. Intentar Insertar User #4 (DEBE FALLAR)
  BEGIN
    INSERT INTO public.users (id, email) VALUES (user4_id, 'u4@test.com') ON CONFLICT DO NOTHING;
    INSERT INTO company_members (company_id, user_id, role) VALUES (company_id, user4_id, 'viewer');
    
    RAISE EXCEPTION '❌ TEST 2 FAILED: Trigger allow exceeding user limit.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Plan limit reached%' THEN
      RAISE NOTICE '✅ TEST 2 PASSED: Limit enforcement worked (%s)', SQLERRM;
    ELSE
      RAISE EXCEPTION '❌ TEST 2 FAILED: Unexpected error: %', SQLERRM;
    END IF;
  END;

END $$;

ROLLBACK;
