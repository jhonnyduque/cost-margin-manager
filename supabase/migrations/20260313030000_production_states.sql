-- Migration: Phase 4 - Production Order States
-- Description: Adds status management and state transitions to production orders.

-- 1. Create the status enum type
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_status') THEN
        CREATE TYPE public.production_status AS ENUM ('planned', 'cutting', 'sewing', 'finished', 'cancelled');
    END IF;
END $$;

-- 2. Add columns to production_orders
ALTER TABLE public.production_orders 
ADD COLUMN IF NOT EXISTS status public.production_status DEFAULT 'planned',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 3. Update existing orders to 'finished' status for compatibility
UPDATE public.production_orders SET status = 'finished' WHERE status IS NULL;

-- 4. Helper function to consume materials (Internal use only)
CREATE OR REPLACE FUNCTION internal_consume_materials_for_order(
    p_order_id UUID,
    p_company_id UUID,
    p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_id UUID;
    v_quantity NUMERIC;
    v_recipe JSONB;
    v_material RECORD;
    v_remaining_required_base NUMERIC;
    v_batch RECORD;
    v_consumed_base NUMERIC;
    v_subtotal NUMERIC;
    v_total_cost NUMERIC := 0;
    v_has_debt BOOLEAN := FALSE;
    v_product_name TEXT;
    v_roll_width NUMERIC;
    v_pieces_numeric NUMERIC;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Get order details
    SELECT product_id, quantity INTO v_product_id, v_quantity
    FROM public.production_orders WHERE id = p_order_id;

    -- Get product details
    SELECT name, materials INTO v_product_name, v_recipe
    FROM public.products WHERE id = v_product_id;

    -- Material Consumption (FIFO)
    FOR v_material IN SELECT * FROM jsonb_to_recordset(v_recipe) AS x(
        material_id UUID, 
        quantity NUMERIC, 
        mode TEXT, 
        pieces JSONB, -- Changed from NUMERIC to JSONB to support arrays []
        consumption_unit TEXT
    )
    LOOP
        -- Handle pieces: sum if it's an array, cast if it's a number, default to 0
        v_pieces_numeric := 0;
        IF v_material.pieces IS NOT NULL THEN
            IF jsonb_typeof(v_material.pieces) = 'array' THEN
                SELECT COALESCE(SUM(val::NUMERIC), 0) INTO v_pieces_numeric 
                FROM jsonb_array_elements(v_material.pieces) AS val;
            ELSIF jsonb_typeof(v_material.pieces) = 'number' THEN
                v_pieces_numeric := v_material.pieces::NUMERIC;
            END IF;
        END IF;

        IF v_material.mode = 'pieces' THEN
            SELECT width INTO v_roll_width FROM public.material_batches 
            WHERE material_id = v_material.material_id AND company_id = p_company_id AND base_remaining_quantity > 0
            ORDER BY date DESC, created_at DESC LIMIT 1;
            
            IF v_roll_width IS NULL OR v_roll_width = 0 THEN v_roll_width := 1.5; END IF;
            
            -- Use the calculated v_pieces_numeric
            v_remaining_required_base := (v_pieces_numeric / v_roll_width) * v_quantity;
        ELSE
            v_remaining_required_base := COALESCE(v_material.quantity, 0) * v_quantity;
        END IF;

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

            UPDATE public.material_batches
            SET 
                base_remaining_quantity = base_remaining_quantity - v_consumed_base,
                base_consumed_quantity = COALESCE(base_consumed_quantity, 0) + v_consumed_base,
                updated_at = v_now,
                updated_by = p_actor_id
            WHERE id = v_batch.id;

            INSERT INTO public.stock_movements (
                company_id, material_id, batch_id, date, type, quantity, unit_cost, reference, production_order_id, created_at
            ) VALUES (
                p_company_id, v_material.material_id, v_batch.id, v_now, 'egreso', v_consumed_base, v_batch.cost_per_base_unit, 'Prod: ' || v_product_name, p_order_id, v_now
            );

            v_remaining_required_base := v_remaining_required_base - v_consumed_base;
        END LOOP;

        IF v_remaining_required_base > 0 THEN
            v_has_debt := TRUE;
            SELECT cost_per_base_unit INTO v_subtotal FROM public.material_batches 
            WHERE material_id = v_material.material_id AND company_id = p_company_id ORDER BY date DESC LIMIT 1;
            v_total_cost := v_total_cost + (v_remaining_required_base * COALESCE(v_subtotal, 0));

            INSERT INTO public.stock_movements (
                company_id, material_id, batch_id, date, type, quantity, unit_cost, reference, production_order_id, created_at
            ) VALUES (
                p_company_id, v_material.material_id, NULL, v_now, 'egreso_asumido', v_remaining_required_base, COALESCE(v_subtotal, 0), 'Faltante Prod: ' || v_product_name, p_order_id, v_now
            );
        END IF;
    END LOOP;

    -- Update order with costs and debt
    UPDATE public.production_orders
    SET 
        unit_cost = CASE WHEN v_quantity > 0 THEN v_total_cost / v_quantity ELSE 0 END,
        total_cost = v_total_cost,
        debt_generated = v_has_debt,
        started_at = v_now
    WHERE id = p_order_id;
END;
$$;

-- 5. RPC to Transition Order State
CREATE OR REPLACE FUNCTION transition_production_order(
    p_order_id UUID,
    p_new_status public.production_status,
    p_company_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status public.production_status;
    v_product_id UUID;
    v_quantity NUMERIC;
    v_unit_cost NUMERIC;
    v_product_name TEXT;
    v_has_debt BOOLEAN;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Get current state
    SELECT status, product_id, quantity, unit_cost, debt_generated 
    INTO v_current_status, v_product_id, v_quantity, v_unit_cost, v_has_debt
    FROM public.production_orders 
    WHERE id = p_order_id AND company_id = p_company_id;

    IF v_current_status IS NULL THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
    IF v_current_status = p_new_status THEN RETURN jsonb_build_object('success', true, 'message', 'Ya está en ese estado'); END IF;

    -- 2. Business Logic per transition
    
    -- Transition to CUTTING (Consumption Point)
    IF p_new_status = 'cutting' AND v_current_status = 'planned' THEN
        PERFORM public.internal_consume_materials_for_order(p_order_id, p_company_id, p_actor_id);
    END IF;

    -- Transition to FINISHED (Product Inflow Point)
    IF p_new_status = 'finished' THEN
        IF v_current_status = 'planned' THEN
             PERFORM public.internal_consume_materials_for_order(p_order_id, p_company_id, p_actor_id);
             -- Re-fetch cost after consumption
             SELECT unit_cost, debt_generated INTO v_unit_cost, v_has_debt FROM public.production_orders WHERE id = p_order_id;
        END IF;

        SELECT name INTO v_product_name FROM public.products WHERE id = v_product_id;

        INSERT INTO public.product_movements (
            company_id, product_id, type, quantity, unit_cost, reference, produced_with_debt, production_order_id, created_at
        ) VALUES (
            p_company_id, v_product_id, 'ingreso_produccion', v_quantity, v_unit_cost, 'Finalizado OP: ' || p_order_id, v_has_debt, p_order_id, v_now
        );
        
        UPDATE public.production_orders SET completed_at = v_now WHERE id = p_order_id;
    END IF;

    -- 3. Update Order Status
    UPDATE public.production_orders 
    SET status = p_new_status, updated_at = v_now 
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_status', p_new_status
    );
END;
$$;

-- 6. RPC to Create Planned Order
CREATE OR REPLACE FUNCTION create_production_order_v4(
    p_product_id UUID,
    p_quantity NUMERIC,
    p_company_id UUID,
    p_actor_id UUID,
    p_status public.production_status DEFAULT 'planned'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    INSERT INTO public.production_orders (
        company_id, product_id, quantity, actor_id, status, created_at
    ) VALUES (
        p_company_id, p_product_id, p_quantity, p_actor_id, p_status, v_now
    ) RETURNING id INTO v_order_id;

    -- If created directly as finished or cutting, trigger transitions
    IF p_status <> 'planned' THEN
        PERFORM public.transition_production_order(v_order_id, p_status, p_company_id, p_actor_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'status', p_status
    );
END;
$$;
