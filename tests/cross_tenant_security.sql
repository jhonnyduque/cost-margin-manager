-- ============================================================================
-- TEST DE PENETRACIÓN (FASE 4A) - SEGURIDAD CROSS-TENANT
-- ============================================================================
-- Requiere: 00_setup_test_env.sql ejecutado previamente.
-- Objetivo: Intentar violar el aislamiento multi-tenant y verificar bloqueo.
-- Todos los tests usan BEGIN...ROLLBACK — seguros en cualquier entorno.
-- ============================================================================
-- CONVENCIÓN DE RESULTADOS:
--   ✅ PASSED — La operación fue bloqueada correctamente
--   ❌ FAILED — La operación NO fue bloqueada (fallo de seguridad)
-- ============================================================================

BEGIN;

DO $$
DECLARE
  company_a UUID := '11111111-1111-1111-1111-111111111111';
  company_b UUID := '22222222-2222-2222-2222-222222222222';

  owner_a UUID := '00000000-0000-0000-0000-000000000001';
  owner_b UUID := '00000000-0000-0000-0000-000000000002';

  material_a   UUID;
  material_a2  UUID;
  material_b   UUID;
  batch_a      UUID;
  batch_a_wrong UUID;
  batch_b      UUID;
  product_b    UUID;
BEGIN
  RAISE NOTICE '=== INICIANDO TEST DE PENETRACIÓN CROSS-TENANT (FASE 4A) ===';

  -- ──────────────────────────────────────────────────────────────────────────
  -- SETUP: Crear Company B y sus recursos (como service_role)
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO companies (id, slug, name, subscription_status, subscription_tier)
  VALUES (company_b, 'evil-corp-test', 'Evil Corp', 'active', 'professional')
  ON CONFLICT (id) DO UPDATE SET name = 'Evil Corp';

  INSERT INTO auth.users (id, email) VALUES (owner_b, 'hacker@evil.com') ON CONFLICT DO NOTHING;
  INSERT INTO company_members (company_id, user_id, role) VALUES (company_b, owner_b, 'owner') ON CONFLICT DO NOTHING;

  -- Recursos de Company A (víctima)
  INSERT INTO raw_materials (company_id, name, unit)
  VALUES (company_a, 'Material A (Protected)', 'kg')
  RETURNING id INTO material_a;

  INSERT INTO raw_materials (company_id, name, unit)
  VALUES (company_a, 'Material A2 (Protected)', 'kg')
  RETURNING id INTO material_a2;

  INSERT INTO material_batches (company_id, material_id, initial_quantity, remaining_quantity, unit_cost)
  VALUES (company_a, material_a, 200, 200, 30)
  RETURNING id INTO batch_a;

  INSERT INTO material_batches (company_id, material_id, initial_quantity, remaining_quantity, unit_cost)
  VALUES (company_a, material_a2, 100, 100, 20)
  RETURNING id INTO batch_a_wrong;

  -- Recursos de Company B (atacante)
  INSERT INTO raw_materials (company_id, name, unit)
  VALUES (company_b, 'Material B (Evil)', 'kg')
  RETURNING id INTO material_b;

  INSERT INTO material_batches (company_id, material_id, initial_quantity, remaining_quantity, unit_cost)
  VALUES (company_b, material_b, 100, 100, 50)
  RETURNING id INTO batch_b;

  INSERT INTO products (company_id, name, price)
  VALUES (company_b, 'Product B (Evil)', 99.99)
  RETURNING id INTO product_b;


  -- ──────────────────────────────────────────────────────────────────────────
  -- Simular sesión de usuario de Company A (el atacante o usuario confundido)
  -- ──────────────────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', '{"sub": "' || owner_a || '", "email": "admin@companya.com"}', true);
  PERFORM set_config('role', 'authenticated', true);


  -- ══════════════════════════════════════════════════════════════════════════
  -- TEST 1: INSERT movimiento en Company A usando Batch de Company B
  -- Expected: FAIL (Trigger — Cross-tenant Security Violation)
  -- ══════════════════════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO stock_movements (company_id, material_id, batch_id, type, quantity, unit_cost)
    VALUES (company_a, material_a, batch_b, 'egreso', 10, 10);

    RAISE EXCEPTION '❌ TEST 1 FAILED: Allowed cross-tenant batch assignment!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cross-tenant Security Violation%' OR SQLERRM LIKE '%policy%' THEN
      RAISE NOTICE '✅ TEST 1 PASSED: Blocked cross-tenant batch usage. Error: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '❌ TEST 1 FAILED: Unexpected error: %', SQLERRM;
    END IF;
  END;


  -- ══════════════════════════════════════════════════════════════════════════
  -- TEST 2: INSERT movimiento con batch de material incorrecto (misma company)
  -- Expected: FAIL (Trigger — Data Integrity Violation)
  -- ══════════════════════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO stock_movements (company_id, material_id, batch_id, type, quantity, unit_cost)
    VALUES (company_a, material_a, batch_a_wrong, 'egreso', 10, 10);

    RAISE EXCEPTION '❌ TEST 2 FAILED: Allowed mismatched material-batch assignment!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Data Integrity Violation%' THEN
      RAISE NOTICE '✅ TEST 2 PASSED: Blocked mismatched material-batch. Error: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '❌ TEST 2 FAILED: Unexpected error: %', SQLERRM;
    END IF;
  END;


  -- ══════════════════════════════════════════════════════════════════════════
  -- TEST 3: INSERT movimiento con material_id de Company B
  -- Expected: FAIL (Trigger — Cross-tenant Security Violation)
  -- ══════════════════════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO stock_movements (company_id, material_id, type, quantity, unit_cost)
    VALUES (company_a, material_b, 'egreso', 5, 10);

    RAISE EXCEPTION '❌ TEST 3 FAILED: Allowed movement with foreign material_id!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cross-tenant Security Violation%' OR SQLERRM LIKE '%policy%' THEN
      RAISE NOTICE '✅ TEST 3 PASSED: Blocked movement with foreign material. Error: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '❌ TEST 3 FAILED: Unexpected error: %', SQLERRM;
    END IF;
  END;


  -- ══════════════════════════════════════════════════════════════════════════
  -- TEST 4: SELECT productos de Company B (como usuario de Company A)
  -- Expected: FAIL (RLS — 0 rows returned)
  -- ══════════════════════════════════════════════════════════════════════════
  DECLARE
    visible_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO visible_count
    FROM products
    WHERE company_id = company_b;

    IF visible_count = 0 THEN
      RAISE NOTICE '✅ TEST 4 PASSED: User A cannot see products of Company B (0 rows).';
    ELSE
      RAISE EXCEPTION '❌ TEST 4 FAILED: User A can see % product(s) of Company B!', visible_count;
    END IF;
  END;


  -- ══════════════════════════════════════════════════════════════════════════
  -- TEST 5: DELETE batch de Company B (como usuario de Company A)
  -- Expected: FAIL (RLS — 0 rows affected, no exception but no effect)
  -- ══════════════════════════════════════════════════════════════════════════
  DECLARE
    rows_deleted INTEGER;
  BEGIN
    DELETE FROM material_batches WHERE id = batch_b;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;

    IF rows_deleted = 0 THEN
      RAISE NOTICE '✅ TEST 5 PASSED: User A cannot DELETE batch of Company B (0 rows affected).';
    ELSE
      RAISE EXCEPTION '❌ TEST 5 FAILED: User A deleted % batch(es) from Company B!', rows_deleted;
    END IF;
  END;


  -- ══════════════════════════════════════════════════════════════════════════
  -- TEST 6: UPDATE batch de Company B (como usuario de Company A)
  -- Expected: FAIL (RLS — 0 rows affected)
  -- ══════════════════════════════════════════════════════════════════════════
  DECLARE
    rows_updated INTEGER;
  BEGIN
    UPDATE material_batches
    SET remaining_quantity = 0
    WHERE id = batch_b;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    IF rows_updated = 0 THEN
      RAISE NOTICE '✅ TEST 6 PASSED: User A cannot UPDATE batch of Company B (0 rows affected).';
    ELSE
      RAISE EXCEPTION '❌ TEST 6 FAILED: User A updated % batch(es) from Company B!', rows_updated;
    END IF;
  END;


  RAISE NOTICE '=== TODOS LOS TESTS DE PENETRACIÓN FINALIZADOS ===';

END $$;

ROLLBACK;
