-- ============================================================================
-- FASE 0: CORE SCHEMA - Multi-Tenant Foundation
-- ============================================================================
-- Descripción: Crea las tablas fundamentales para multi-tenancy
-- Autor: Sistema
-- Fecha: 2026-02-18
-- ============================================================================
-- Deshabilitar RLS temporalmente (template obligatorio)
SET session_replication_role = replica;
-- ============================================================================
-- TABLA: companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  -- Subscription fields
  subscription_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  subscription_tier TEXT NOT NULL DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  -- Trial and grace periods
  trial_ends_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: SOLO se crea si NO existe ya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND indexname = 'companies_slug_unique'
  ) THEN
    CREATE UNIQUE INDEX companies_slug_unique
      ON companies(slug)
      WHERE deleted_at IS NULL;
  ELSE
    RAISE NOTICE 'Índice companies_slug_unique ya existe, se omite su creación.';
  END IF;
END $$;

-- Índices para performance (estos también se pueden hacer idempotentes si quieres, pero suelen ser menos problemáticos)
CREATE INDEX IF NOT EXISTS companies_subscription_status_idx ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS companies_stripe_customer_idx ON companies(stripe_customer_id);
CREATE INDEX IF NOT EXISTS companies_deleted_at_idx ON companies(deleted_at) WHERE deleted_at IS NULL;

-- ... el resto del script sigue exactamente igual ...
-- (tablas users, company_members, subscription_plans, seed data, subscription_events, internal_actions_log, company_usage_metrics)

-- Restaurar configuración normal
SET session_replication_role = DEFAULT;

-- Verificación final
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000000_phase0_core_schema.sql completed successfully';
  RAISE NOTICE 'Tables created/verified: companies, users, company_members, subscription_plans, subscription_events, internal_actions_log, company_usage_metrics';
END $$;