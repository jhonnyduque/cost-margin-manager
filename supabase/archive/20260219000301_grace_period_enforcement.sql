-- ============================================================================
-- MODELO BETO: GRACE PERIOD ENFORCEMENT
-- ============================================================================

-- Refinamos la función de ayuda para incluir el periodo de gracia
CREATE OR REPLACE FUNCTION public.is_company_active(cid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_status TEXT;
    v_sub_status TEXT;
    v_grace BOOLEAN;
BEGIN
    -- Obtenemos el status de suscripción y verificamos periodo de gracia
    SELECT 
        c.subscription_status, 
        ba.billing_status,
        public.is_within_grace_period(cid)
    INTO v_status, v_sub_status, v_grace
    FROM public.companies c
    LEFT JOIN public.billing_accounts ba ON ba.company_id = c.id
    WHERE c.id = cid AND c.deleted_at IS NULL;

    -- Acceso permitido si:
    -- 1. Status es active o trialing
    -- 2. Status es past_due pero está en periodo de gracia
    RETURN (v_status IN ('active', 'trialing')) OR (v_status = 'past_due' AND v_grace);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Nota: Como user_companies() y user_role_in_company() ya usan JOINs o subconsultas
-- que dependen del status de la tabla companies, debemos asegurar que el 
-- subscription_status de la tabla companies se mantenga sincronizado con Stripe.
-- Esta función is_company_active será la fuente de verdad para validaciones manuales.
