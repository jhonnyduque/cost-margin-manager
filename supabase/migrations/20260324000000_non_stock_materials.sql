-- Migration: Phase 1 & 2 - Non-Stock Materials & Cost Absorption
-- Description: Introduces generates_stock and standard_cost flags, and the production_cost_absorptions table.

-- 1. Modificar raw_materials
ALTER TABLE public.raw_materials
ADD COLUMN IF NOT EXISTS generates_stock BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(15,4) NULL;

-- 2. Asegurar la integridad de datos
-- Bloque anónimo para añadir la restricción de forma segura
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_raw_materials_stock_cost') THEN
        ALTER TABLE public.raw_materials
        ADD CONSTRAINT chk_raw_materials_stock_cost CHECK (
            (generates_stock = true) OR 
            (generates_stock = false AND standard_cost IS NOT NULL AND standard_cost > 0)
        );
    END IF;
END $$;

-- 3. Crear tabla production_cost_absorptions
CREATE TABLE IF NOT EXISTS public.production_cost_absorptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    quantity_used NUMERIC(15,4) NOT NULL,
    unit_cost NUMERIC(15,4) NOT NULL,
    total_cost NUMERIC(15,4) NOT NULL,
    cost_source TEXT NOT NULL DEFAULT 'standard_cost',
    material_name_snapshot TEXT NULL,
    unit_snapshot TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES auth.users(id)
);

-- 4. Indices para rendimiento y auditoría
CREATE INDEX IF NOT EXISTS idx_prod_absorp_company ON public.production_cost_absorptions(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_absorp_order ON public.production_cost_absorptions(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_absorp_material ON public.production_cost_absorptions(material_id);
CREATE INDEX IF NOT EXISTS idx_prod_absorp_date ON public.production_cost_absorptions(created_at);

-- 5. Enable RLS
ALTER TABLE public.production_cost_absorptions ENABLE ROW LEVEL SECURITY;

-- 6. RBAC / RLS Policies (Company scoping)
CREATE POLICY "production_cost_absorptions_select"
    ON public.production_cost_absorptions FOR SELECT
    TO authenticated
    USING (
        is_super_admin() 
        OR company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "production_cost_absorptions_insert"
    ON public.production_cost_absorptions FOR INSERT
    TO authenticated
    WITH CHECK (
        is_super_admin() 
        OR user_is_admin_or_manager(company_id)
    );

CREATE POLICY "production_cost_absorptions_update"
    ON public.production_cost_absorptions FOR UPDATE
    TO authenticated
    USING (
        is_super_admin() 
        OR user_is_admin_or_manager(company_id)
    )
    WITH CHECK (
        is_super_admin() 
        OR user_is_admin_or_manager(company_id)
    );
