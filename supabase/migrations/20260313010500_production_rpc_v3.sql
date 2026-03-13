-- BETO OS: MOTOR DE PRODUCCIÓN ATÓMICO v3
-- Migración de lógica de cliente a servidor (RPC)

CREATE OR REPLACE FUNCTION public.process_production_v3(
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
    v_old_price NUMERIC;
    v_materials_json JSONB;
    v_pm RECORD;
    v_material_id UUID;
    v_req_qty_base NUMERIC;
    v_conversion_factor NUMERIC;
    v_base_unit_symbol TEXT;
    v_roll_width NUMERIC;
    v_piece RECORD;
    v_total_area_cm2 NUMERIC;
    v_batch RECORD;
    v_to_consume NUMERIC;
    v_remaining_req NUMERIC;
    v_total_cost_production NUMERIC := 0;
    v_has_debt BOOLEAN := false;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_result JSONB;
BEGIN
    -- 1. Validar producto y obtener receta
    SELECT name, materials, price INTO v_product_name, v_materials_json, v_old_price
    FROM public.products
    WHERE id = p_product_id AND company_id = p_company_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado o no pertenece a la compañía';
    END IF;

    IF v_materials_json IS NULL OR jsonb_array_length(v_materials_json) = 0 THEN
        RAISE EXCEPTION 'El producto no tiene materiales definidos';
    END IF;

    -- 2. Procesar cada material de la receta
    FOR v_pm IN SELECT * FROM jsonb_array_elements(v_materials_json) LOOP
        v_material_id := (v_pm.value->>'material_id')::UUID;
        
        -- Obtener metadata del material y unidad de medida
        SELECT u.conversion_factor, u.symbol 
        INTO v_conversion_factor, v_base_unit_symbol
        FROM public.raw_materials m
        JOIN public.units_of_measure u ON m.base_unit_id = u.id
        WHERE m.id = v_material_id;

        -- Calcular cantidad requerida en unidad base
        IF (v_pm.value->>'mode') = 'pieces' AND (v_pm.value->'pieces') IS NOT NULL AND jsonb_array_length(v_pm.value->'pieces') > 0 THEN
            -- Lógica de piezas a metros lineales
            v_total_area_cm2 := 0;
            FOR v_piece IN SELECT * FROM jsonb_array_elements(v_pm.value->'pieces') LOOP
                v_total_area_cm2 := v_total_area_cm2 + ((v_piece.value->>'length')::NUMERIC * (v_piece.value->>'width')::NUMERIC);
            END LOOP;

            -- Obtener ancho de rollo más reciente
            SELECT width INTO v_roll_width
            FROM public.material_batches
            WHERE material_id = v_material_id AND company_id = p_company_id AND deleted_at IS NULL
            ORDER BY date DESC LIMIT 1;
            
            IF v_roll_width IS NULL OR v_roll_width = 0 THEN v_roll_width := 140; END IF;

            -- (totalAreaCm2 / rollWidth) / 100 * p_quantity * conversion_factor
            v_req_qty_base := (v_total_area_cm2 / v_roll_width) / 100 * p_quantity * v_conversion_factor;
        ELSE
            -- Lógica lineal/estándar
            v_req_qty_base := (v_pm.value->>'quantity')::NUMERIC * p_quantity * v_conversion_factor;
        END IF;

        v_remaining_req := v_req_qty_base;

        -- 3. Algoritmo FIFO
        FOR v_batch IN 
            SELECT id, base_remaining_quantity, cost_per_base_unit, remaining_quantity, received_unit_id
            FROM public.material_batches
            WHERE material_id = v_material_id 
              AND company_id = p_company_id 
              AND base_remaining_quantity > 0 
              AND deleted_at IS NULL
            ORDER BY date ASC
        LOOP
            IF v_remaining_req <= 0 THEN EXIT; END IF;

            v_to_consume := LEAST(v_remaining_req, v_batch.base_remaining_quantity);
            
            -- Actualizar Lote
            UPDATE public.material_batches
            SET 
                base_remaining_quantity = base_remaining_quantity - v_to_consume,
                base_consumed_quantity = COALESCE(base_consumed_quantity, 0) + v_to_consume,
                -- Actualizar remaining_quantity legacy
                remaining_quantity = CASE 
                    WHEN v_batch.received_unit_id IS NOT NULL THEN
                        (SELECT (base_remaining_quantity - v_to_consume) / conversion_factor 
                         FROM public.units_of_measure WHERE id = v_batch.received_unit_id)
                    ELSE remaining_quantity - (v_to_consume / v_conversion_factor)
                END,
                updated_at = v_now,
                updated_by = p_actor_id
            WHERE id = v_batch.id;

            -- Registrar Movimiento
            INSERT INTO public.stock_movements (
                company_id, material_id, batch_id, date, type, quantity, unit_cost, reference, created_at
            ) VALUES (
                p_company_id, v_material_id, v_batch.id, v_now, 'egreso', 
                v_to_consume / v_conversion_factor,
                v_batch.cost_per_base_unit * v_conversion_factor,
                'Prod Lote: ' || v_product_name,
                v_now
            );

            v_total_cost_production := v_total_cost_production + (v_to_consume * v_batch.cost_per_base_unit);
            v_remaining_req := v_remaining_req - v_to_consume;
        END LOOP;

        -- 4. Manejo de Deuda (Stock Faltante)
        IF v_remaining_req > 0 THEN
            v_has_debt := true;
            DECLARE
                v_fallback_cost NUMERIC;
            BEGIN
                SELECT cost_per_base_unit INTO v_fallback_cost
                FROM public.material_batches
                WHERE material_id = v_material_id AND company_id = p_company_id
                ORDER BY date DESC LIMIT 1;
                
                IF v_fallback_cost IS NULL THEN v_fallback_cost := 0; END IF;

                INSERT INTO public.stock_movements (
                    company_id, material_id, batch_id, date, type, quantity, unit_cost, reference, created_at
                ) VALUES (
                    p_company_id, v_material_id, NULL, v_now, 'egreso_asumido', 
                    v_remaining_req / v_conversion_factor,
                    v_fallback_cost * v_conversion_factor,
                    'Faltante Lote (Prod_ID: ' || p_product_id || ')',
                    v_now
                );
                
                v_total_cost_production := v_total_cost_production + (v_remaining_req * v_fallback_cost);
            END;
        END IF;
    END LOOP;

    -- 5. Registrar entrada de Producto Terminado
    INSERT INTO public.product_movements (
        company_id, product_id, type, quantity, unit_cost, reference, produced_with_debt, created_at
    ) VALUES (
        p_company_id, p_product_id, 'ingreso_produccion', p_quantity, 
        v_total_cost_production / p_quantity,
        'Lote Producción: ' || p_quantity || ' uds',
        v_has_debt,
        v_now
    );

    -- 5.1 Actualizar precio si se requiere
    IF p_target_price IS NOT NULL AND p_target_price <> v_old_price THEN
        UPDATE public.products 
        SET price = p_target_price, updated_at = v_now, updated_by = p_actor_id
        WHERE id = p_product_id AND company_id = p_company_id;
    END IF;

    -- 6. Construir Respuesta
    v_result := jsonb_build_object(
        'success', true,
        'product_name', v_product_name,
        'total_cost', v_total_cost_production,
        'unit_cost', v_total_cost_production / p_quantity,
        'has_debt', v_has_debt,
        'timestamp', v_now
    );

    RETURN v_result;
END;
$$;
