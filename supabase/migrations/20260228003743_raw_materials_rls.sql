-- Migration: raw_materials_rls
-- Objetivo: Restringir operaciones sobre raw_materials según rol de usuario

-- 1. Eliminar políticas actuales que otorgan acceso demasiado permisivo o ambiguo
DROP POLICY IF EXISTS "raw_materials_delete" ON "public"."raw_materials";
DROP POLICY IF EXISTS "raw_materials_insert" ON "public"."raw_materials";
DROP POLICY IF EXISTS "raw_materials_select" ON "public"."raw_materials";
DROP POLICY IF EXISTS "raw_materials_update" ON "public"."raw_materials";

-- 2. Lectura (SELECT): Todos los miembros activos de la empresa ("operator", "reader", "manager", "admin") pueden ver
-- Se mantiene la condición de ocultar lo que tiene `deleted_at IS NOT NULL`
CREATE POLICY "raw_materials_select" 
ON "public"."raw_materials" 
FOR SELECT 
USING (
  (public.is_super_admin() OR (company_id IN (SELECT public.user_companies())))
  AND deleted_at IS NULL
);

-- 3. Inserción (INSERT): Solo "manager" o "admin" (o super_admin)
CREATE POLICY "raw_materials_insert" 
ON "public"."raw_materials" 
FOR INSERT 
WITH CHECK (
  public.is_super_admin() OR (
    company_id IN (SELECT public.user_companies()) 
    AND public.has_role_level(company_id, 'manager'::text)
  )
);

-- 4. Actualización (UPDATE): Ojo, esto cubre tanto edición real como el Soft-Delete (set deleted_at)
-- Restringido a "manager" o superior. 
CREATE POLICY "raw_materials_update" 
ON "public"."raw_materials" 
FOR UPDATE 
USING (
  public.is_super_admin() OR (
    company_id IN (SELECT public.user_companies()) 
    AND public.has_role_level(company_id, 'manager'::text)
  )
)
WITH CHECK (
  public.is_super_admin() OR (
    company_id IN (SELECT public.user_companies()) 
    AND public.has_role_level(company_id, 'manager'::text)
  )
);

-- 5. Eliminación física (DELETE): Esto no se usa convencionalmente en el frontend 
-- porque enviamos soft-deletes, pero cerramos la puerta por seguridad.
CREATE POLICY "raw_materials_delete" 
ON "public"."raw_materials" 
FOR DELETE 
USING (
  public.is_super_admin() OR (
    company_id IN (SELECT public.user_companies()) 
    AND public.has_role_level(company_id, 'manager'::text)
  )
);
