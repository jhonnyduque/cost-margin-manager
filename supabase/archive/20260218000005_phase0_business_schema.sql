-- ============================================================================
-- FASE 0: BUSINESS SCHEMA & MIGRATION (FIXED / IDEMPOTENT / SUPABASE-SAFE)
-- ============================================================================
-- Fixes aplicados:
-- ✅ Idempotencia total (policies, indexes, triggers)
-- ✅ Evita errores por objetos ya existentes
-- ✅ Corrige índice products_deleted_idx (estaba al revés)
-- ✅ Asegura uso de public.* helpers + search_path
-- ✅ Evita CREATE TRIGGER duplicados (DROP IF EXISTS)
-- ✅ Usa CREATE POLICY ... IF NOT EXISTS cuando está disponible; si tu Postgres
--    no lo soporta, el bloque DO crea policies solo si no existen.
-- ============================================================================

SET search_path = public;

-- En migraciones Supabase NO es necesario tocar session_replication_role.
-- Quita replica si no estás replicando; lo dejamos porque venía en tu script.
SET session_replication_role = replica;

-- ============================================================================
-- 1) TABLA: products
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reference TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_margin NUMERIC(5,2) DEFAULT 0,
  cost_fifo NUMERIC(12,2) DEFAULT 0,
  materials JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'activa' CHECK (status IN ('activa', 'inactiva')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policies (creación segura)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'products_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY products_select ON public.products FOR SELECT
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
      )
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'products_modify'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY products_modify ON public.products FOR ALL
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
      )
    $sql$;
  END IF;
END $$;

-- Índices (idempotentes)
CREATE INDEX IF NOT EXISTS products_company_idx
  ON public.products(company_id);

-- FIX: antes decía WHERE deleted_at IS NULL (eso indexa NO borrados en un índice "deleted")
-- Mejor: indexar SOLO los borrados (deleted_at IS NOT NULL) o renombrar el índice.
CREATE INDEX IF NOT EXISTS products_deleted_at_idx
  ON public.products(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 2) TABLA: raw_materials
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  unit TEXT CHECK (unit IN ('metro', 'cm', 'kg', 'gramo', 'bobina', 'unidad', 'litro')),
  provider TEXT,
  status TEXT DEFAULT 'activa' CHECK (status IN ('activa', 'inactiva')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'raw_materials' AND policyname = 'raw_materials_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY raw_materials_select ON public.raw_materials FOR SELECT
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
      )
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'raw_materials' AND policyname = 'raw_materials_modify'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY raw_materials_modify ON public.raw_materials FOR ALL
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
      )
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS raw_materials_company_idx
  ON public.raw_materials(company_id);

-- ============================================================================
-- 3) TABLA: material_batches
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.material_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,

  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT,
  initial_quantity NUMERIC(12,4) NOT NULL,
  remaining_quantity NUMERIC(12,4) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL,

  reference TEXT,
  width NUMERIC(10,2),
  length NUMERIC(10,2),
  area NUMERIC(10,2),
  entry_mode TEXT CHECK (entry_mode IN ('rollo', 'pieza')),

  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.material_batches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'material_batches' AND policyname = 'batches_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY batches_select ON public.material_batches FOR SELECT
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
      )
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'material_batches' AND policyname = 'batches_modify'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY batches_modify ON public.material_batches FOR ALL
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
      )
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS batches_company_material_idx
  ON public.material_batches(company_id, material_id);

-- ============================================================================
-- 4) TABLA: stock_movements
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.material_batches(id),

  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
  quantity NUMERIC(12,4) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL,
  reference TEXT,

  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_movements' AND policyname = 'movements_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY movements_select ON public.stock_movements FOR SELECT
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
      )
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_movements' AND policyname = 'movements_modify'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY movements_modify ON public.stock_movements FOR ALL
      USING (
        public.is_super_admin() OR
        (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
      )
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS movements_company_date_idx
  ON public.stock_movements(company_id, date);

-- ============================================================================
-- TRIGGERS updated_at (idempotentes)
-- Requiere que exista public.update_updated_at_column() (de tu fase triggers fix).
-- ============================================================================
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_raw_materials_updated_at ON public.raw_materials;
CREATE TRIGGER update_raw_materials_updated_at
BEFORE UPDATE ON public.raw_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_batches_updated_at ON public.material_batches;
CREATE TRIGGER update_batches_updated_at
BEFORE UPDATE ON public.material_batches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

SET session_replication_role = DEFAULT;

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000005_phase0_business_schema.sql FIXED completed';
  RAISE NOTICE 'Created/verified business tables: products, raw_materials, material_batches, stock_movements';
END $$;