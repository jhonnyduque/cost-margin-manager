-- ============================================================================
-- FASE 0: AUDIT LOGS (PARTITIONED TABLE)
-- ============================================================================
-- CRÍTICO: Esta tabla DEBE estar particionada desde día 1
-- Sin partitioning, queries se vuelven lentas a los 6 meses (900M records)
-- ============================================================================

SET session_replication_role = replica;

-- ============================================================================
-- TABLA: audit_logs (PARTITIONED BY created_at)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Denormalización para retention post-deletion
  user_email TEXT,
  user_role TEXT,
  
  -- Acción realizada
  action TEXT NOT NULL,  -- create, update, delete, login, export, etc.
  resource_type TEXT NOT NULL,  -- product, user, company_settings, etc.
  resource_id UUID,
  
  -- Valores old/new (JSONB)
  old_values JSONB,
  new_values JSONB,
  
  -- Contexto de la request
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- PRIMARY KEY incluye partition key
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- CREAR PARTICIONES para los próximos 6 meses
-- ============================================================================
-- Febrero 2026
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');

-- Marzo 2026
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');

-- Abril 2026
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');

-- Mayo 2026
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

-- Junio 2026
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- Julio 2026
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

-- ============================================================================
-- ÍNDICES en particiones (PostgreSQL los crea automáticamente)
-- ============================================================================
CREATE INDEX audit_logs_company_idx ON audit_logs(company_id, created_at DESC);
CREATE INDEX audit_logs_user_idx ON audit_logs(user_id, created_at DESC);
CREATE INDEX audit_logs_resource_idx ON audit_logs(resource_type, resource_id);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);

-- ============================================================================
-- FUNCIÓN: Crear partición automática del próximo mes
-- ============================================================================
-- Esta función debe ser llamada mensualmente por pg_cron
CREATE OR REPLACE FUNCTION create_next_month_audit_partition()
RETURNS void AS $$
DECLARE
  next_month_start DATE;
  next_month_end DATE;
  partition_name TEXT;
BEGIN
  next_month_start := date_trunc('month', NOW() + INTERVAL '1 month');
  next_month_end := next_month_start + INTERVAL '1 month';
  partition_name := 'audit_logs_' || to_char(next_month_start, 'YYYY_MM');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    next_month_start,
    next_month_end
  );
  
  RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

SET session_replication_role = DEFAULT;

-- Verificación
DO $$
DECLARE
  partition_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO partition_count
  FROM pg_tables
  WHERE tablename LIKE 'audit_logs_%';
  
  RAISE NOTICE 'Migration 20260218000001_phase0_audit_logs.sql completed';
  RAISE NOTICE 'Partitions created: %', partition_count;
  
  IF partition_count < 3 THEN
    RAISE EXCEPTION 'CRITICAL: Less than 3 partitions created. Expected at least 3.';
  END IF;
END $$;
