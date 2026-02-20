-- ============================================================================
-- FASE 2: ENFORCEMENT & LIMITS
-- ============================================================================
-- Descripción: Implementa triggers de defensa en profundidad.
-- 1. Bloqueo por estado de suscripción (Kill Switch).
-- 2. Límite de usuarios por plan (Atomic Control).
-- 3. Datos semilla de planes.
-- ============================================================================

-- IMPORTANTE:
-- Para atomicidad en inserciones (Max Users Limit), usaremos `LOCK TABLE` o `SELECT FOR UPDATE` 
-- de la fila *PADRE* (Company).
-- Bloquear las filas hijas no previene inserciones concurrentes (Phantom Reads).
-- Aquí usamos `SELECT FROM companies ... FOR UPDATE` para lograr atomicidad real.

-- 1. SEED DATA: Subscription Plans
INSERT INTO subscription_plans (slug, name, max_users, max_products, max_storage_mb, monthly_price_cents)
VALUES 
  ('starter', 'Starter Limitado', 3, 100, 1000, 0),
  ('pro', 'Pro Ilimitado', 10, 1000, 10000, 2900),
  ('enterprise', 'Enterprise', 9999, 99999, 100000, 9900)
ON CONFLICT (slug) DO UPDATE
SET max_users = EXCLUDED.max_users,
    max_products = EXCLUDED.max_products;

-- 2. TRIGGER FUNCTION: Block Writes on Suspended/Read-Only
CREATE OR REPLACE FUNCTION public.enforce_company_status()
RETURNS TRIGGER AS $$
DECLARE
  access_level TEXT;
BEGIN
  -- Service Role Bypass (Importante para Webhooks)
  IF (current_setting('role', true) = 'service_role') THEN
    RETURN NEW;
  END IF;

  access_level := public.get_company_suspension_level(NEW.company_id);

  -- BLOCKED: Kill Switch Total
  IF access_level = 'blocked' THEN
    RAISE EXCEPTION 'Action blocked: Company is suspended/blocked.';
  END IF;

  -- READ_ONLY: Allow DELETE only
  IF access_level = 'read_only' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      RAISE EXCEPTION 'Read-only mode: Subscription past due. Writes disabled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. TRIGGER FUNCTION: Enforce User Limits (Atomic)
CREATE OR REPLACE FUNCTION public.enforce_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  max_allowed INT;
  current_count INT;
BEGIN
  -- Service Role Bypass
  IF (current_setting('role', true) = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- 1. Obtener límite del plan
  SELECT sp.max_users INTO max_allowed
  FROM companies c
  JOIN subscription_plans sp ON c.subscription_tier = sp.slug
  WHERE c.id = NEW.company_id;

  -- 2. ATOMIC LOCK: Bloquear la fila de la COMPANY para serializar inserts concurrentes
  -- Esto previene "phantom reads" donde 2 requests cuentan 2 usuarios y ambos insertan el 3ro.
  PERFORM 1 FROM companies WHERE id = NEW.company_id FOR UPDATE;

  -- 3. Contar
  SELECT COUNT(*) INTO current_count
  FROM company_members
  WHERE company_id = NEW.company_id AND is_active = true;
  -- Note: FOR UPDATE on members is redundant if parent is locked, but harmless.

  -- 4. Validar
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Plan limit reached: Your plan allows max % users.', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. APLICAR TRIGGERS

-- A) Users Limit
DROP TRIGGER IF EXISTS check_users_limit ON company_members;
CREATE TRIGGER check_users_limit
BEFORE INSERT ON company_members
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.enforce_user_limit();

-- B) Status Enforcement (Tablas de Negocio)
-- PRODUCTS
DROP TRIGGER IF EXISTS prevent_writes_suspended ON products;
CREATE TRIGGER prevent_writes_suspended
BEFORE INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_status();
