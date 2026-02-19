-- SIMULACION WEBHOOKS V4 (AUTO-CONTENIDO)
-- Ejecutar en Supabase SQL Editor

BEGIN; -- Iniciar Transacción General

-- 1. SETUP GLOBAL: Crear Company de prueba
DO $$
BEGIN
  RAISE NOTICE '--- SETUP: Creando datos de prueba ---';
  
  -- Limpiar por si acaso (aunque el ROLLBACK final debería encargarse)
  DELETE FROM subscription_events WHERE company_id = '11111111-1111-1111-1111-111111111111';
  DELETE FROM company_members WHERE company_id = '11111111-1111-1111-1111-111111111111';
  DELETE FROM companies WHERE id = '11111111-1111-1111-1111-111111111111';

  -- Insertar Company de Prueba (CRÍTICO para evitar error de FK)
  INSERT INTO companies (id, slug, name, subscription_status, subscription_tier)
  VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'test-webhook-company', 
    'Test Webhook Company', 
    'active',
    'starter'
  );
END $$;


-- 2. TEST PAGO FALLIDO
DO $$
DECLARE
  company_id UUID := '11111111-1111-1111-1111-111111111111';
  level TEXT;
BEGIN
  RAISE NOTICE '--- TEST 1: Payment Failed (Gracia Activa) ---';

  INSERT INTO subscription_events (company_id, stripe_event_id, event_type, payload, status)
  VALUES (
    company_id,
    'evt_test_failed_001',
    'invoice.payment_failed',
    '{"id": "evt_test_failed_001", "type": "invoice.payment_failed"}'::jsonb,
    'processed'
  );

  UPDATE companies
  SET subscription_status = 'past_due',
      grace_period_ends_at = NOW() + INTERVAL '7 days'
  WHERE id = company_id;

  SELECT public.get_company_suspension_level(company_id) INTO level;
  
  IF level = 'none' THEN
    RAISE NOTICE '✅ TEST 1 PASSED (Nivel: %)', level;
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED (Esperado: none, Obtenido: %)', level;
  END IF;
END $$;


-- 3. TEST GRACIA EXPIRADA
DO $$
DECLARE
  company_id UUID := '11111111-1111-1111-1111-111111111111';
  level TEXT;
BEGIN
  RAISE NOTICE '--- TEST 2: Grace Expired ---';

  UPDATE companies
  SET grace_period_ends_at = NOW() - INTERVAL '1 day'
  WHERE id = company_id;

  SELECT public.get_company_suspension_level(company_id) INTO level;
  
  IF level = 'read_only' THEN
    RAISE NOTICE '✅ TEST 2 PASSED (Nivel: %)', level;
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED (Esperado: read_only, Obtenido: %)', level;
  END IF;
END $$;


-- 4. TEST PAGO EXITOSO
DO $$
DECLARE
  company_id UUID := '11111111-1111-1111-1111-111111111111';
  level TEXT;
BEGIN
  RAISE NOTICE '--- TEST 3: Payment Succeeded ---';

  INSERT INTO subscription_events (company_id, stripe_event_id, event_type, payload, status)
  VALUES (
    company_id,
    'evt_test_paid_002',
    'invoice.payment_succeeded',
    '{"id": "evt_test_paid_002", "type": "invoice.payment_succeeded"}'::jsonb,
    'processed'
  );

  UPDATE companies
  SET subscription_status = 'active',
      grace_period_ends_at = NULL
  WHERE id = company_id;

  SELECT public.get_company_suspension_level(company_id) INTO level;
  
  IF level = 'none' THEN
    RAISE NOTICE '✅ TEST 3 PASSED (Nivel: %)', level;
  ELSE
    RAISE EXCEPTION '❌ TEST 3 FAILED (Esperado: none, Obtenido: %)', level;
  END IF;
END $$;

ROLLBACK; -- Limpieza final garantizada
