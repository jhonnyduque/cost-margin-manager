-- Migration: Create Product Movements Table for Finished Goods Ledger
-- Purpose: Maintain atomic source of truth for all produced and sold items.

CREATE TYPE product_movement_type AS ENUM ('ingreso_produccion', 'salida_venta', 'ajuste');

CREATE TABLE IF NOT EXISTS public.product_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type product_movement_type NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_product_movements_company_id ON public.product_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_product_id ON public.product_movements(product_id);

-- Row Level Security (RLS)
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

-- Select Policy
CREATE POLICY "Users can view product_movements in their company"
ON public.product_movements
FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = product_movements.company_id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);

-- Insert Policy
CREATE POLICY "Users can insert product_movements in their company"
ON public.product_movements
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = product_movements.company_id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);

-- Update Policy
CREATE POLICY "Users can update product_movements in their company"
ON public.product_movements
FOR UPDATE
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = product_movements.company_id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);

-- Delete Policy
CREATE POLICY "Users can delete product_movements in their company"
ON public.product_movements
FOR DELETE
USING (
  public.is_super_admin()
  OR EXISTS (
      SELECT 1
      FROM public.company_members cm
      WHERE cm.company_id = product_movements.company_id
      AND cm.user_id = public.user_id()
      AND cm.is_active = true
  )
);
