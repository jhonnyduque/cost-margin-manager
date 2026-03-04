-- ============================================================================
-- MIGRACIÓN: RBAC Role-Based Policies v2 — Definitiva
-- Fecha:     2026-03-03
-- Proyecto:  BETO OS
-- Motivo:    Hallazgo #5 Auditoría — RBAC solo existía en frontend.
--
-- EJECUTAR: Supabase Dashboard → SQL Editor → Run
--
-- MATRIZ DE PERMISOS APROBADA:
--   ┌──────────────────┬─────────────┬─────────┬──────────┬────────┐
--   │ Acción           │ super_admin │ manager │ operator │ viewer │
--   ├──────────────────┼─────────────┼─────────┼──────────┼────────┤
--   │ Ver    (SELECT)  │     ✅      │   ✅    │    ✅    │   ✅   │
--   │ Crear  (INSERT)  │     ✅      │   ✅    │    ✅    │   ✅   │
--   │ Editar (UPDATE)  │     ✅      │   ✅    │    ❌    │   ❌   │
--   │ Archivar (UPDATE)│     ✅      │   ✅    │    ❌    │   ❌   │
--   │ Eliminar(DELETE) │     ✅      │   ✅    │    ❌    │   ❌   │
--   └──────────────────┴─────────────┴─────────┴──────────┴────────┘
--
-- TABLAS: products, raw_materials, material_batches, stock_movements
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  1. HELPER: Obtener el rol del usuario para una empresa               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Retorna el rol del usuario autenticado en la empresa indicada.
-- Retorna NULL si no es miembro activo → ninguna policy lo deja pasar.
CREATE OR REPLACE FUNCTION public.get_user_role_for_company(target_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT cm.role
    FROM company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id = target_company_id
      AND cm.is_active = true
    LIMIT 1
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_role_for_company(uuid) IS
  'Retorna el rol del usuario autenticado en la empresa dada. NULL si no es miembro activo.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  2. PRODUCTS                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── SELECT: Cualquier miembro activo de la empresa ──────────────────────
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select"
ON public.products FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND deleted_at IS NULL
  )
);
COMMENT ON POLICY "products_select" ON public.products IS
  'Lectura: super_admin + cualquier miembro activo. Excluye soft-deleted.';

-- ── INSERT: Cualquier miembro activo puede registrar ────────────────────
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR company_id IN (SELECT public.user_companies())
);
COMMENT ON POLICY "products_insert" ON public.products IS
  'Creación: super_admin + cualquier miembro activo. Operadores y trabajadores pueden registrar.';

-- ── UPDATE: Solo super_admin + manager ──────────────────────────────────
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update"
ON public.products FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "products_update" ON public.products IS
  'Edición + soft-delete: solo super_admin + manager. operator/viewer bloqueados.';

-- ── DELETE: Solo super_admin + manager ──────────────────────────────────
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete"
ON public.products FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "products_delete" ON public.products IS
  'Eliminación física: solo super_admin + manager.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  3. RAW_MATERIALS                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "raw_materials_select" ON public.raw_materials;
CREATE POLICY "raw_materials_select"
ON public.raw_materials FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND deleted_at IS NULL
  )
);
COMMENT ON POLICY "raw_materials_select" ON public.raw_materials IS
  'Lectura: cualquier miembro activo. Excluye soft-deleted.';

DROP POLICY IF EXISTS "raw_materials_insert" ON public.raw_materials;
CREATE POLICY "raw_materials_insert"
ON public.raw_materials FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR company_id IN (SELECT public.user_companies())
);
COMMENT ON POLICY "raw_materials_insert" ON public.raw_materials IS
  'Creación: cualquier miembro activo puede registrar materias primas.';

DROP POLICY IF EXISTS "raw_materials_update" ON public.raw_materials;
CREATE POLICY "raw_materials_update"
ON public.raw_materials FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "raw_materials_update" ON public.raw_materials IS
  'Edición + soft-delete: solo super_admin + manager.';

DROP POLICY IF EXISTS "raw_materials_delete" ON public.raw_materials;
CREATE POLICY "raw_materials_delete"
ON public.raw_materials FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "raw_materials_delete" ON public.raw_materials IS
  'Eliminación física: solo super_admin + manager.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4. MATERIAL_BATCHES                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "batches_select" ON public.material_batches;
CREATE POLICY "batches_select"
ON public.material_batches FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND deleted_at IS NULL
  )
);
COMMENT ON POLICY "batches_select" ON public.material_batches IS
  'Lectura de lotes: cualquier miembro activo.';

DROP POLICY IF EXISTS "batches_insert" ON public.material_batches;
CREATE POLICY "batches_insert"
ON public.material_batches FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR company_id IN (SELECT public.user_companies())
);
COMMENT ON POLICY "batches_insert" ON public.material_batches IS
  'Creación de lotes: cualquier miembro activo. El trabajador de piso puede registrar entradas.';

DROP POLICY IF EXISTS "batches_update" ON public.material_batches;
CREATE POLICY "batches_update"
ON public.material_batches FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "batches_update" ON public.material_batches IS
  'Edición de lotes: solo super_admin + manager.';

DROP POLICY IF EXISTS "batches_delete" ON public.material_batches;
CREATE POLICY "batches_delete"
ON public.material_batches FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "batches_delete" ON public.material_batches IS
  'Eliminación física de lotes: solo super_admin + manager.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  5. STOCK_MOVEMENTS                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "movements_select" ON public.stock_movements;
CREATE POLICY "movements_select"
ON public.stock_movements FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND deleted_at IS NULL
  )
);
COMMENT ON POLICY "movements_select" ON public.stock_movements IS
  'Lectura de movimientos: cualquier miembro activo.';

DROP POLICY IF EXISTS "movements_insert" ON public.stock_movements;
CREATE POLICY "movements_insert"
ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR company_id IN (SELECT public.user_companies())
);
COMMENT ON POLICY "movements_insert" ON public.stock_movements IS
  'Creación de movimientos: cualquier miembro activo (registrar consumos/entradas).';

DROP POLICY IF EXISTS "movements_update" ON public.stock_movements;
CREATE POLICY "movements_update"
ON public.stock_movements FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "movements_update" ON public.stock_movements IS
  'Edición de movimientos: solo super_admin + manager.';

DROP POLICY IF EXISTS "movements_delete" ON public.stock_movements;
CREATE POLICY "movements_delete"
ON public.stock_movements FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    company_id IN (SELECT public.user_companies())
    AND public.get_user_role_for_company(company_id) IN ('super_admin', 'manager')
  )
);
COMMENT ON POLICY "movements_delete" ON public.stock_movements IS
  'Eliminación de movimientos: solo super_admin + manager.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICACIÓN MANUAL                                                   ║
-- ║  Ejecutar después de aplicar para validar que operator/viewer           ║
-- ║  pueden SELECT+INSERT pero NO UPDATE+DELETE                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 1. Autenticarse como 'operator' en una empresa
-- 2. SELECT * FROM products WHERE company_id = '...'    → ✅ debe retornar datos
-- 3. INSERT INTO products (...) VALUES (...)             → ✅ debe funcionar
-- 4. UPDATE products SET name='test' WHERE id='...'      → ❌ debe fallar (RLS)
-- 5. DELETE FROM products WHERE id='...'                 → ❌ debe fallar (RLS)


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ROLLBACK — Revertir a policies anteriores (permisivas)                ║
-- ║  Ejecutar SOLO si algo sale mal.                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
/*
DROP FUNCTION IF EXISTS public.get_user_role_for_company(uuid);

-- Products
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT
  USING (public.is_super_admin() OR (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL));
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id))
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id));

-- Raw Materials
DROP POLICY IF EXISTS "raw_materials_select" ON public.raw_materials;
CREATE POLICY "raw_materials_select" ON public.raw_materials FOR SELECT
  USING (public.is_super_admin() OR (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL));
DROP POLICY IF EXISTS "raw_materials_insert" ON public.raw_materials;
CREATE POLICY "raw_materials_insert" ON public.raw_materials FOR INSERT
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "raw_materials_update" ON public.raw_materials;
CREATE POLICY "raw_materials_update" ON public.raw_materials FOR UPDATE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id))
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "raw_materials_delete" ON public.raw_materials;
CREATE POLICY "raw_materials_delete" ON public.raw_materials FOR DELETE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id));

-- Batches
DROP POLICY IF EXISTS "batches_select" ON public.material_batches;
CREATE POLICY "batches_select" ON public.material_batches FOR SELECT
  USING (public.is_super_admin() OR (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL));
DROP POLICY IF EXISTS "batches_insert" ON public.material_batches;
CREATE POLICY "batches_insert" ON public.material_batches FOR INSERT
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "batches_update" ON public.material_batches;
CREATE POLICY "batches_update" ON public.material_batches FOR UPDATE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id))
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "batches_delete" ON public.material_batches;
CREATE POLICY "batches_delete" ON public.material_batches FOR DELETE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id));

-- Stock Movements
DROP POLICY IF EXISTS "movements_select" ON public.stock_movements;
CREATE POLICY "movements_select" ON public.stock_movements FOR SELECT
  USING (public.is_super_admin() OR (company_id IN (SELECT public.user_companies()) AND deleted_at IS NULL));
DROP POLICY IF EXISTS "movements_insert" ON public.stock_movements;
CREATE POLICY "movements_insert" ON public.stock_movements FOR INSERT
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "movements_update" ON public.stock_movements;
CREATE POLICY "movements_update" ON public.stock_movements FOR UPDATE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id))
  WITH CHECK (is_super_admin() OR user_is_admin_or_manager(company_id));
DROP POLICY IF EXISTS "movements_delete" ON public.stock_movements;
CREATE POLICY "movements_delete" ON public.stock_movements FOR DELETE
  USING (is_super_admin() OR user_is_admin_or_manager(company_id));
*/
