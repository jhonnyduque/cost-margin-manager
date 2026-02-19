-- ============================================================================
-- FASE 4A: DOMAIN SECURITY HARDENING
-- ============================================================================
-- Objetivo: Garantizar aislamiento absoluto y consistencia referencial cruzada.
-- Trigger "Defense in Depth" en stock_movements.
-- ============================================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_check_integrity ON stock_movements;
--   DROP FUNCTION IF EXISTS public.check_cross_tenant_integrity();
-- ============================================================================

-- 1. FUNCIÓN DE INTEGRIDAD CRUZADA
-- Valida que company_id coincida en toda la cadena: Movement -> raw_material -> Batch
CREATE OR REPLACE FUNCTION public.check_cross_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
  material_company_id UUID;
  batch_company_id    UUID;
  batch_material_id   UUID;
BEGIN
  -- Bypass para service_role (migrations, seeders)
  IF (current_setting('role', true) = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- A. company_id obligatorio
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Integrity Error: company_id is required.';
  END IF;

  -- B. Validar que el raw_material pertenece a la misma company
  --    FIX: se consulta raw_materials (no products)
  SELECT company_id INTO material_company_id
  FROM raw_materials
  WHERE id = NEW.material_id;

  IF material_company_id IS NULL THEN
    RAISE EXCEPTION 'Integrity Error: material_id % does not exist.', NEW.material_id;
  END IF;

  IF material_company_id <> NEW.company_id THEN
    RAISE EXCEPTION
      'Cross-tenant Security Violation: material % belongs to a different company.',
      NEW.material_id;
  END IF;

  -- C. Validar Batch (si existe)
  IF NEW.batch_id IS NOT NULL THEN
    SELECT company_id, material_id
      INTO batch_company_id, batch_material_id
    FROM material_batches
    WHERE id = NEW.batch_id;

    IF batch_company_id IS NULL THEN
      RAISE EXCEPTION 'Integrity Error: batch_id % does not exist.', NEW.batch_id;
    END IF;

    -- C.1. Batch Ownership
    IF batch_company_id <> NEW.company_id THEN
      RAISE EXCEPTION
        'Cross-tenant Security Violation: batch % belongs to a different company.',
        NEW.batch_id;
    END IF;

    -- C.2. Consistencia vertical: el batch debe ser del mismo material
    IF batch_material_id <> NEW.material_id THEN
      RAISE EXCEPTION
        'Data Integrity Violation: batch % belongs to material %, not to %.',
        NEW.batch_id, batch_material_id, NEW.material_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER (idempotente)
DROP TRIGGER IF EXISTS trg_check_integrity ON stock_movements;

CREATE TRIGGER trg_check_integrity
BEFORE INSERT OR UPDATE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.check_cross_tenant_integrity();

-- ============================================================================
-- FIN MIGRACIÓN
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_check_integrity ON stock_movements;
--   DROP FUNCTION IF EXISTS public.check_cross_tenant_integrity();
-- ============================================================================
