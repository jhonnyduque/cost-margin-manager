-- Migration: Phase 5 - RPC Production Engine Update
-- Description: Bifurcates internal_consume_materials_for_order to handle non-stock materials.

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

    -- New variables for Phase 5
    v_mat_generates_stock BOOLEAN;
    v_mat_standard_cost NUMERIC;
    v_mat_name TEXT;
BEGIN
    -- Get order details
    SELECT product_id, quantity INTO v_product_id, v_quantity
    FROM public.production_orders WHERE id = p_order_id;

    -- Get product details
    SELECT name, materials INTO v_product_name, v_recipe
    FROM public.products WHERE id = v_product_id;

    -- Material Consumption Loop
    FOR v_material IN SELECT * FROM jsonb_to_recordset(v_recipe) AS x(
        material_id UUID, 
        quantity NUMERIC, 
        mode TEXT, 
        pieces JSONB,
        consumption_unit TEXT
    )
    LOOP
        -- Fetch material config for Stock vs Cost differentiation
        SELECT generates_stock, standard_cost, name 
        INTO v_mat_generates_stock, v_mat_standard_cost, v_mat_name
        FROM public.raw_materials WHERE id = v_material.material_id;

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
            
            v_remaining_required_base := (v_pieces_numeric / v_roll_width) * v_quantity;
        ELSE
            v_remaining_required_base := COALESCE(v_material.quantity, 0) * v_quantity;
        END IF;

        -- ==========================================
        -- CASE B: NON-STOCK MATERIAL (COST ONLY)
        -- ==========================================
        IF v_mat_generates_stock = FALSE THEN
            IF v_mat_standard_cost IS NULL OR v_mat_standard_cost <= 0 THEN
                RAISE EXCEPTION 'El insumo "%" requiere un costo estándar válido mayor a 0 para ser producido.', v_mat_name;
            END IF;

            v_subtotal := v_remaining_required_base * v_mat_standard_cost;
            v_total_cost := v_total_cost + v_subtotal;

            INSERT INTO public.production_cost_absorptions (
                company_id, production_order_id, material_id, 
                quantity_used, unit_cost, total_cost, 
                cost_source, material_name_snapshot, unit_snapshot, 
                created_at, created_by
            ) VALUES (
                p_company_id, p_order_id, v_material.material_id, 
                v_remaining_required_base, v_mat_standard_cost, v_subtotal, 
                'standard_cost', v_mat_name, v_material.consumption_unit, 
                v_now, p_actor_id
            );

            CONTINUE; -- Skip physical inventory logic
        END IF;

        -- ==========================================
        -- CASE A: PHYSICAL STOCK MATERIAL (FIFO)
        -- ==========================================
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
