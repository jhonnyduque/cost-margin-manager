-- Migration: Generalización de Estados de Producción
-- Description: Renombra estados específicos de costura a términos agnósticos para diferentes industrias.

-- 1. Renombrar 'cutting' a 'preparation'
ALTER TYPE public.production_status RENAME VALUE 'cutting' TO 'preparation';

-- 2. Renombrar 'sewing' a 'processing'
ALTER TYPE public.production_status RENAME VALUE 'sewing' TO 'processing';

-- NOTA: Como el enum fue modificado, las filas que usaban estos valores se actualizan automáticamente.
-- Los RPCs que referenciaban estos literales deben ser actualizados si tienen lógica específica.

-- 3. Actualizar RPC transition_production_order para reflejar nuevos nombres si es que usa literales de texto
-- (Re-creamos el RPC con los nuevos nombres de estados)

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
    
    -- Transition to PREPARATION (Ex-Cutting) (Consumption Point)
    IF p_new_status = 'preparation' AND v_current_status = 'planned' THEN
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
