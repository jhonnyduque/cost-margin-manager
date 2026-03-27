-- 1. ASEGURAR RLS ACTIVADO (por seguridad)
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 2. LIMPIEZA DE POLITICAS VIEJAS (para que no choquen)
DROP POLICY IF EXISTS "raw_materials_full_mgmt" ON public.raw_materials;
DROP POLICY IF EXISTS "products_full_mgmt" ON public.products;
DROP POLICY IF EXISTS "batches_full_mgmt" ON public.material_batches;
DROP POLICY IF EXISTS "movements_full_mgmt" ON public.stock_movements;
DROP POLICY IF EXISTS "raw_materials_admin_policy_v4" ON public.raw_materials;
DROP POLICY IF EXISTS "raw_materials_update_final" ON public.raw_materials;
DROP POLICY IF EXISTS "raw_materials_delete_final" ON public.raw_materials;

-- 3. POLÍTICAS DEFINITIVAS - ACCESO TOTAL PARA ADMIN/OWNER/MANAGER
-- Usamos una comprobación directa sobre company_members para evitar bugs de cache o de funciones intermedias.
-- El WITH CHECK (true) es vital para permitir que el resultado de un soft-delete (deleted_at IS NOT NULL) sea aceptado por Postgres.

CREATE POLICY "raw_materials_full_mgmt" ON public.raw_materials FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid() AND company_id = raw_materials.company_id AND role IN ('owner', 'admin', 'manager', 'super_admin')))
WITH CHECK (true);

CREATE POLICY "products_full_mgmt" ON public.products FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid() AND company_id = products.company_id AND role IN ('owner', 'admin', 'manager', 'super_admin')))
WITH CHECK (true);

CREATE POLICY "batches_full_mgmt" ON public.material_batches FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid() AND company_id = material_batches.company_id AND role IN ('owner', 'admin', 'manager', 'super_admin')))
WITH CHECK (true);

CREATE POLICY "movements_full_mgmt" ON public.stock_movements FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid() AND company_id = stock_movements.company_id AND role IN ('owner', 'admin', 'manager', 'super_admin')))
WITH CHECK (true);
