-- =============================================================================
-- Migración: 20260307200000_dynamic_taxonomies.sql
-- Gestión Dinámica de Taxonomías (Tipos de Material, UOM, Categorías)
-- =============================================================================

-- 1. Tabla: material_types
CREATE TABLE IF NOT EXISTS public.material_types (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    name         text          UNIQUE NOT NULL,
    created_at   timestamptz   DEFAULT now() NOT NULL
);

-- 2. Seed Inicial (Mapeo de la lista hardcoded legacy)
INSERT INTO public.material_types (name) 
VALUES ('Tela'), ('Hilo'), ('Herrajes'), ('Accesorios'), ('Otros')
ON CONFLICT (name) DO NOTHING;

-- 3. RLS & SECURITY
ALTER TABLE public.material_types ENABLE ROW LEVEL SECURITY;

-- 3.1. Lectura pública para usuarios autenticados
CREATE POLICY "Allow all authenticated to read material_types" 
ON public.material_types FOR SELECT 
TO authenticated 
USING (true);

-- 3.2. Gestión exclusiva para Super Admins
CREATE POLICY "Allow super_admins to manage material_types" 
ON public.material_types FOR ALL 
TO authenticated 
USING (public.is_super_admin());

-- 4. Actualizar RLS para Taxonomías de Unidades (UOM)
-- Nota: Asumimos que public.is_super_admin() ya existe y funciona.

DROP POLICY IF EXISTS "Allow super_admins to manage uom_categories" ON public.uom_categories;
CREATE POLICY "Allow super_admins to manage uom_categories" 
ON public.uom_categories FOR ALL 
TO authenticated 
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Allow super_admins to manage units_of_measure" ON public.units_of_measure;
CREATE POLICY "Allow super_admins to manage units_of_measure" 
ON public.units_of_measure FOR ALL 
TO authenticated 
USING (public.is_super_admin());

-- 5. Comentario para auditoría
COMMENT ON TABLE public.material_types IS 'Taxonomía dinámica de tipos de materias primas gestionada por Super Admin.';
