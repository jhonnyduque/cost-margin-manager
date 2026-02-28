-- ============================================================================
-- MIGRACIÓN CRÍTICA: Restringir INSERT/UPDATE/DELETE a Admin/Manager solamente
-- ============================================================================

-- Función helper para verificar si el usuario es admin o manager
CREATE OR REPLACE FUNCTION user_is_admin_or_manager(target_company_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id = auth.uid()
        AND cm.company_id = target_company_id
        AND cm.is_active = true
        AND cm.role IN ('admin', 'manager', 'owner')
    )
    OR is_super_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PRODUCTS
-- ============================================================================

DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update"
ON public.products
FOR UPDATE
TO authenticated
USING (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
)
WITH CHECK (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete"
ON public.products
FOR DELETE
TO authenticated
USING (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

-- ============================================================================
-- MATERIAL_BATCHES
-- ============================================================================

DROP POLICY IF EXISTS "batches_insert" ON public.material_batches;
CREATE POLICY "batches_insert"
ON public.material_batches
FOR INSERT
TO authenticated
WITH CHECK (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

DROP POLICY IF EXISTS "batches_update" ON public.material_batches;
CREATE POLICY "batches_update"
ON public.material_batches
FOR UPDATE
TO authenticated
USING (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
)
WITH CHECK (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

DROP POLICY IF EXISTS "batches_delete" ON public.material_batches;
CREATE POLICY "batches_delete"
ON public.material_batches
FOR DELETE
TO authenticated
USING (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

-- ============================================================================
-- STOCK_MOVEMENTS
-- ============================================================================

DROP POLICY IF EXISTS "movements_insert" ON public.stock_movements;
CREATE POLICY "movements_insert"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

DROP POLICY IF EXISTS "movements_update" ON public.stock_movements;
CREATE POLICY "movements_update"
ON public.stock_movements
FOR UPDATE
TO authenticated
USING (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
)
WITH CHECK (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);

DROP POLICY IF EXISTS "movements_delete" ON public.stock_movements;
CREATE POLICY "movements_delete"
ON public.stock_movements
FOR DELETE
TO authenticated
USING (
    is_super_admin() 
    OR user_is_admin_or_manager(company_id)
);
