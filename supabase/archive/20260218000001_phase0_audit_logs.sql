-- ============================================================================
-- FASE 0: AUDIT LOGS (PARTITIONED TABLE) - IDP SAFE
-- ============================================================================
-- Objetivo: Que la migración sea IDEMPOTENTE (no revienta si ya existe algo)
-- ============================================================================

-- NOTA: Evitamos session_replication_role aquí para no saltarnos constraints/triggers críticos.
-- Si realmente necesitas esto en local, se hace con cuidado, pero para remoto NO lo recomiendo.

-- ============================================================================
-- TABLA PADRE: audit_logs (PARTITIONED BY created_at)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Denormalización
  user_email TEXT,
  user_role TEXT,

  -- Acción
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,

  -- Valores old/new
  old_values JSONB,
  new_values JSONB,

  -- Contexto request
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PRIMARY KEY incluye partition key
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- FUNCIÓN AUX: crear partición si NO existe
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_audit_partition(p_start timestamptz, p_end timestamptz)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  partition_name text;
BEGIN
  partition_name := 'audit_logs_' || to_char(p_start, 'YYYY_MM');

  -- Si ya existe tabla con ese nombre, no hacemos nada
  IF to_regclass('public.' || partition_name) IS NOT NULL THEN
    RETURN;
  END IF;

  EXECUTE format(
    'CREATE TABLE %I PARTITION OF public.audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    p_start,
    p_end
  );
END;
$$;

-- ============================================================================
-- CREAR PARTICIONES (próximos 6 meses) de forma segura
-- ============================================================================
DO $$
DECLARE
  m int;
  start_month timestamptz;
  end_month timestamptz;
BEGIN
  -- Crea particiones desde el mes actual (UTC) hacia adelante 6 meses
  FOR m IN 0..5 LOOP
    start_month := date_trunc('month', now() AT TIME ZONE 'UTC') + (m || ' month')::interval;
    end_month   := start_month + interval '1 month';

    PERFORM public.ensure_audit_partition(start_month, end_month);
  END LOOP;
END;
$$;

-- ============================================================================
-- ÍNDICES (en la tabla padre; Postgres los propaga a particiones nuevas)
-- ============================================================================
CREATE INDEX IF NOT EXISTS audit_logs_company_idx ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);

-- ============================================================================
-- FUNCIÓN: Crear partición automática del próximo mes (idempotente)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_next_month_audit_partition()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  next_month_start timestamptz;
  next_month_end   timestamptz;
BEGIN
  next_month_start := date_trunc('month', now() AT TIME ZONE 'UTC' + interval '1 month');
  next_month_end   := next_month_start + interval '1 month';

  PERFORM public.ensure_audit_partition(next_month_start, next_month_end);
END;
$$;

-- ============================================================================
-- Verificación (segura)
-- ============================================================================
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*)
    INTO cnt
  FROM pg_inherits i
  JOIN pg_class c ON c.oid = i.inhrelid
  JOIN pg_class p ON p.oid = i.inhparent
  WHERE p.relname = 'audit_logs';

  RAISE NOTICE 'Migration 20260218000001_phase0_audit_logs.sql completed';
  RAISE NOTICE 'Partitions attached to audit_logs: %', cnt;

  IF cnt < 1 THEN
    RAISE EXCEPTION 'CRITICAL: No partitions attached to audit_logs.';
  END IF;
END $$;