-- ============================================================================
-- FASE 0: BUSINESS SCHEMA & MIGRATION
-- ============================================================================
-- Descripción: Crea las tablas de negocio (Products, Materials, etc.) con support Multi-Tenant
-- Autor: Sistema
-- Fecha: 2026-02-18
-- ============================================================================

SET session_replication_role = replica;

-- ============================================================================
-- 1. TABLA: products
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reference TEXT, -- SKU o referencia interna
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_margin DECIMAL(5,2) DEFAULT 0,
  cost_fifo DECIMAL(12,2) DEFAULT 0, -- Cache del último costo calculado
  
  -- Campos JSON para estructuras flexibles (materials list)
  materials JSONB DEFAULT '[]'::jsonb, 
  
  status TEXT DEFAULT 'activa' CHECK (status IN ('activa', 'inactiva')),
  
  -- Auditoría
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select ON products FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY products_modify ON products FOR ALL
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

-- Índices
CREATE INDEX products_company_idx ON products(company_id);
CREATE INDEX products_deleted_idx ON products(deleted_at) WHERE deleted_at IS NULL;


-- ============================================================================
-- 2. TABLA: raw_materials
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY raw_materials_select ON raw_materials FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY raw_materials_modify ON raw_materials FOR ALL
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE INDEX raw_materials_company_idx ON raw_materials(company_id);


-- ============================================================================
-- 3. TABLA: material_batches (Lotes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS material_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT,
  initial_quantity DECIMAL(12,4) NOT NULL,
  remaining_quantity DECIMAL(12,4) NOT NULL,
  unit_cost DECIMAL(12,4) NOT NULL,
  
  reference TEXT,
  width DECIMAL(10,2),
  length DECIMAL(10,2),
  area DECIMAL(10,2),
  entry_mode TEXT CHECK (entry_mode IN ('rollo', 'pieza')),
  
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE material_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batches_select ON material_batches FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY batches_modify ON material_batches FOR ALL
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE INDEX batches_company_material_idx ON material_batches(company_id, material_id);


-- ============================================================================
-- 4. TABLA: stock_movements (Movimientos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES material_batches(id),
  
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
  quantity DECIMAL(12,4) NOT NULL,
  unit_cost DECIMAL(12,4) NOT NULL,
  reference TEXT,
  
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY movements_select ON stock_movements FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY movements_modify ON stock_movements FOR ALL
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE INDEX movements_company_idx ON stock_movements(company_id, date);


-- ============================================================================
-- TRIGGERS DE UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_raw_materials_updated_at BEFORE UPDATE ON raw_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON material_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


SET session_replication_role = DEFAULT;

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000005_phase0_business_schema.sql completed';
  RAISE NOTICE 'Created business tables: products, raw_materials, material_batches, stock_movements';
END $$;
