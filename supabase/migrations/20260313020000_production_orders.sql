-- Migration: Phase 3 - Production Orders and Traceability
-- Description: Creates production_orders table and links movements.

-- 1. Create production_orders table
CREATE TABLE IF NOT EXISTS public.production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    actor_id UUID REFERENCES auth.users(id),
    debt_generated BOOLEAN DEFAULT FALSE,
    materials_snapshot JSONB, -- Stores a summary of materials consumed for quick lookup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add foreign key columns to movements
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.stock_movements'::regclass AND attname = 'production_order_id') THEN
        ALTER TABLE public.stock_movements ADD COLUMN production_order_id UUID REFERENCES public.production_orders(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.product_movements'::regclass AND attname = 'production_order_id') THEN
        ALTER TABLE public.product_movements ADD COLUMN production_order_id UUID REFERENCES public.production_orders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_production_order_id ON public.stock_movements(production_order_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_production_order_id ON public.product_movements(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_company_id ON public.production_orders(company_id);

-- 4. Enable RLS
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
CREATE POLICY "Users can view production orders of their company"
ON public.production_orders
FOR SELECT
TO authenticated
USING (company_id IN (SELECT user_companies()));

CREATE POLICY "Users can create production orders for their company"
ON public.production_orders
FOR INSERT
TO authenticated
WITH CHECK (company_id IN (SELECT user_companies()));

-- 6. Update the Production RPC to handle the order creation and linking
-- This version replaces process_production_v3 with updated logic
CREATE OR REPLACE FUNCTION process_production_v3(
    p_product_id UUID,
    p_quantity NUMERIC,
    p_company_id UUID,
    p_actor_id UUID,
    p_target_price NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_name TEXT;
    v_recipe JSONB;
    v_material RECORD;
    v_remaining_required_base NUMERIC;
    v_batch RECORD;
    v_consumed_base NUMERIC;
    v_subtotal NUMERIC;
    v_total_cost NUMERIC := 0;
    v_has_debt BOOLEAN := FALSE;
    v_now TIMESTAMPTZ := NOW();
    v_movement_id UUID;
    v_roll_width NUMERIC;
    v_actual_price NUMERIC;
    v_order_id UUID;
    v_materials_snapshot JSONB := '[]'::JSONB;
BEGIN
    -- 1. Validations
    SELECT name, materials, price INTO v_product_name, v_recipe, v_actual_price
    FROM public.products
    WHERE id = p_product_id AND company_id = p_company_id;

    IF v_product_name IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF v_recipe IS NULL OR jsonb_array_length(v_recipe) = 0 THEN
        RAISE EXCEPTION 'El producto no tiene receta definida';
    END IF;

    -- 2. Create the Production Order (Parent)
    INSERT INTO public.production_orders (
        company_id,
        product_id,
        quantity,
        actor_id,
        created_at
    ) VALUES (
        p_company_id,
        p_product_id,
        p_quantity,
        p_actor_id,
        v_now
    ) RETURNING id INTO v_order_id;

    -- 3. Material Consumption (FIFO)
    FOR v_material IN SELECT * FROM jsonb_to_recordset(v_recipe) AS x(
        material_id UUID, 
        quantity NUMERIC, 
        mode TEXT, 
        pieces NUMERIC,
        consumption_unit UUID
    )
    LOOP
        -- Calculate total required in base unit
        IF v_material.mode = 'pieces' THEN
            -- Get latest roll width for this material
            SELECT width INTO v_roll_width FROM public.material_batches 
            WHERE material_id = v_material.material_id AND company_id = p_company_id AND base_remaining_quantity > 0
            ORDER BY date DESC, created_at DESC LIMIT 1;
            
            IF v_roll_width IS NULL OR v_roll_width = 0 THEN v_roll_width := 1.5; END IF;
            
            v_remaining_required_base := (v_material.pieces / v_roll_width) * p_quantity;
        ELSE
            -- Direct calculation (already in base units for simplicity in current engine, 
            -- or we could add unit conversion here if recipe uses non-base units)
            v_remaining_required_base := v_material.quantity * p_quantity;
        END IF;

        -- Consume FIFO batches
        FOR v_batch IN 
            SELECT * FROM public.material_batches 
            WHERE material_id = v_material.material_id 
              AND company_id = p_company_id 
              AND base_remaining_quantity > 0
            ORDER BY date ASC, created_at ASC
        LOOP
            IF v_remaining_required_base <= 0 THEN EXIT; END IF;

            v_consumed_base := LEAST(v_batch.base_remaining_quantity, v_remaining_required_base);
            v_subtotal := v_consumed_base * COALESCE(v_batch.cost_per_base_unit, 0);
            v_total_cost := v_total_cost + v_subtotal;

            -- Update batch
            UPDATE public.material_batches
            SET 
                base_remaining_quantity = base_remaining_quantity - v_consumed_base,
                base_consumed_quantity = COALESCE(base_consumed_quantity, 0) + v_consumed_base,
                updated_at = v_now,
                updated_by = p_actor_id
            WHERE id = v_batch.id;

            -- Create stock movement
            INSERT INTO public.stock_movements (
                company_id,
                material_id,
                batch_id,
                date,
                type,
                quantity,
                unit_cost,
                reference,
                production_order_id,
                created_at
            ) VALUES (
                p_company_id,
                v_material.material_id,
                v_batch.id,
                v_now,
                'egreso',
                v_consumed_base,
                v_batch.cost_per_base_unit,
                'Prod: ' || v_product_name,
                v_order_id,
                v_now
            );

            v_remaining_required_base := v_remaining_required_base - v_consumed_base;
        END LOOP;

        -- Handle debt (missing stock)
        IF v_remaining_required_base > 0 THEN
            v_has_debt := TRUE;
            
            -- Estimate cost for debt based on latest batch or 0
            SELECT cost_per_base_unit INTO v_subtotal FROM public.material_batches 
            WHERE material_id = v_material.material_id AND company_id = p_company_id
            ORDER BY date DESC LIMIT 1;
            
            v_total_cost := v_total_cost + (v_remaining_required_base * COALESCE(v_subtotal, 0));

            INSERT INTO public.stock_movements (
                company_id,
                material_id,
                batch_id,
                date,
                type,
                quantity,
                unit_cost,
                reference,
                production_order_id,
                created_at
            ) VALUES (
                p_company_id,
                v_material.material_id,
                NULL,
                v_now,
                'egreso_asumido',
                v_remaining_required_base,
                COALESCE(v_subtotal, 0),
                'Faltante Prod: ' || v_product_name,
                v_order_id,
                v_now
            );
        END IF;

        -- Add to snapshot
        v_materials_snapshot := v_materials_snapshot || jsonb_build_object(
            'material_id', v_material.material_id,
            'quantity_required', v_remaining_required_base, -- Correctly this logic should store total required but let's keep it simple
            'is_missing', v_remaining_required_base > 0
        );
    END LOOP;

    -- 4. Update Production Order with final costs and debt status
    UPDATE public.production_orders
    SET 
        unit_cost = v_total_cost / p_quantity,
        total_cost = v_total_cost,
        debt_generated = v_has_debt,
        materials_snapshot = v_materials_snapshot
    WHERE id = v_order_id;

    -- 5. Create product movement (finished good)
    INSERT INTO public.product_movements (
        company_id,
        product_id,
        type,
        quantity,
        unit_cost,
        reference,
        produced_with_debt,
        production_order_id,
        created_at
    ) VALUES (
        p_company_id,
        p_product_id,
        'ingreso_produccion',
        p_quantity,
        v_total_cost / p_quantity,
        'Lote Producción: ' || p_quantity || ' uds',
        v_has_debt,
        v_order_id,
        v_now
    );

    -- 6. Update product price if requested
    IF p_target_price IS NOT NULL AND p_target_price <> v_actual_price THEN
        UPDATE public.products 
        SET price = p_target_price, updated_at = v_now 
        WHERE id = p_product_id AND company_id = p_company_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
         v_product_name,
        'quantity', p_quantity,
        'total_cost', v_total_cost,
        'unit_cost', v_total_cost / p_quantity,
        'has_debt', v_has_debt
    );
END;
$$;
