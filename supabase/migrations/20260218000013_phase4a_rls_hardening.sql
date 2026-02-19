-- ============================================================================
-- FASE 4A: RLS HARDENING — WITH CHECK EXPLÍCITO EN TABLAS DE NEGOCIO
-- ============================================================================
-- Objetivo: Reemplazar policies FOR ALL (solo USING) por policies granulares
-- con WITH CHECK explícito en INSERT y UPDATE para las 4 tablas de dominio.
--
-- Auditoría realizada:
--   ✅ products        — RLS habilitado, policies existentes reemplazadas
--   ✅ raw_materials   — RLS habilitado, policies existentes reemplazadas
--   ✅ material_batches — RLS habilitado, policies existentes reemplazadas
--   ✅ stock_movements — RLS habilitado, policies existentes reemplazadas
--
-- Resultado de auditoría:
--   □ Todas las policies filtran por company_id.          ✅
--   □ No existen policies USING (true) en tablas mutables. ✅
--   □ No existen combinaciones permisivas implícitas.      ✅
--   □ WITH CHECK explícito en INSERT y UPDATE.             ✅ (esta migración)
--   □ FK indirectas no permiten escape lógico.            ✅ (cubierto por trigger)
--
-- ROLLBACK:
--   Ver sección al final del archivo.
-- ============================================================================

-- ============================================================================
-- TABLA: products
-- ============================================================================
DROP POLICY IF EXISTS products_select  ON products;
DROP POLICY IF EXISTS products_modify  ON products;
DROP POLICY IF EXISTS products_insert  ON products;
DROP POLICY IF EXISTS products_update  ON products;
DROP POLICY IF EXISTS products_delete  ON products;

-- SELECT: solo filas activas de las companies del usuario
CREATE POLICY products_select ON products
  FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

-- INSERT: el nuevo registro debe pertenecer a una company del usuario
CREATE POLICY products_insert ON products
  FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

-- UPDATE: solo filas de sus companies + el valor nuevo también debe serlo
CREATE POLICY products_update ON products
  FOR UPDATE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  )
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

-- DELETE: solo managers o superiores pueden eliminar (soft delete)
CREATE POLICY products_delete ON products
  FOR DELETE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'manager'))
  );


-- ============================================================================
-- TABLA: raw_materials
-- ============================================================================
DROP POLICY IF EXISTS raw_materials_select ON raw_materials;
DROP POLICY IF EXISTS raw_materials_modify ON raw_materials;
DROP POLICY IF EXISTS raw_materials_insert ON raw_materials;
DROP POLICY IF EXISTS raw_materials_update ON raw_materials;
DROP POLICY IF EXISTS raw_materials_delete ON raw_materials;

CREATE POLICY raw_materials_select ON raw_materials
  FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY raw_materials_insert ON raw_materials
  FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE POLICY raw_materials_update ON raw_materials
  FOR UPDATE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  )
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE POLICY raw_materials_delete ON raw_materials
  FOR DELETE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'manager'))
  );


-- ============================================================================
-- TABLA: material_batches
-- ============================================================================
DROP POLICY IF EXISTS batches_select ON material_batches;
DROP POLICY IF EXISTS batches_modify ON material_batches;
DROP POLICY IF EXISTS batches_insert ON material_batches;
DROP POLICY IF EXISTS batches_update ON material_batches;
DROP POLICY IF EXISTS batches_delete ON material_batches;

CREATE POLICY batches_select ON material_batches
  FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY batches_insert ON material_batches
  FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE POLICY batches_update ON material_batches
  FOR UPDATE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  )
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

CREATE POLICY batches_delete ON material_batches
  FOR DELETE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'manager'))
  );


-- ============================================================================
-- TABLA: stock_movements
-- ============================================================================
DROP POLICY IF EXISTS movements_select ON stock_movements;
DROP POLICY IF EXISTS movements_modify ON stock_movements;
DROP POLICY IF EXISTS movements_insert ON stock_movements;
DROP POLICY IF EXISTS movements_update ON stock_movements;
DROP POLICY IF EXISTS movements_delete ON stock_movements;

CREATE POLICY movements_select ON stock_movements
  FOR SELECT
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL)
  );

CREATE POLICY movements_insert ON stock_movements
  FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'operator'))
  );

-- UPDATE en movimientos: solo managers (los movimientos son casi inmutables por diseño)
CREATE POLICY movements_update ON stock_movements
  FOR UPDATE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'manager'))
  )
  WITH CHECK (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'manager'))
  );

-- DELETE: solo managers (soft delete via deleted_at)
CREATE POLICY movements_delete ON stock_movements
  FOR DELETE
  USING (
    public.is_super_admin() OR
    (company_id IN (SELECT public.user_companies()) AND public.has_role_level(company_id, 'manager'))
  );


-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('products', 'raw_materials', 'material_batches', 'stock_movements');

  RAISE NOTICE 'Migration 20260218000013_phase4a_rls_hardening.sql completed';
  RAISE NOTICE 'RLS policies on domain tables: %', policy_count;

  IF policy_count < 16 THEN
    RAISE WARNING 'Expected at least 16 policies (4 per table × 4 tables), found: %', policy_count;
  END IF;
END $$;


-- ============================================================================
-- ROLLBACK (ejecutar en orden inverso si es necesario revertir):
-- ============================================================================
-- DROP POLICY IF EXISTS products_select  ON products;
-- DROP POLICY IF EXISTS products_insert  ON products;
-- DROP POLICY IF EXISTS products_update  ON products;
-- DROP POLICY IF EXISTS products_delete  ON products;
--
-- DROP POLICY IF EXISTS raw_materials_select ON raw_materials;
-- DROP POLICY IF EXISTS raw_materials_insert ON raw_materials;
-- DROP POLICY IF EXISTS raw_materials_update ON raw_materials;
-- DROP POLICY IF EXISTS raw_materials_delete ON raw_materials;
--
-- DROP POLICY IF EXISTS batches_select ON material_batches;
-- DROP POLICY IF EXISTS batches_insert ON material_batches;
-- DROP POLICY IF EXISTS batches_update ON material_batches;
-- DROP POLICY IF EXISTS batches_delete ON material_batches;
--
-- DROP POLICY IF EXISTS movements_select ON stock_movements;
-- DROP POLICY IF EXISTS movements_insert ON stock_movements;
-- DROP POLICY IF EXISTS movements_update ON stock_movements;
-- DROP POLICY IF EXISTS movements_delete ON stock_movements;
--
-- Luego re-crear las policies originales FOR ALL desde phase0_business_schema.sql
-- ============================================================================
