-- ============================================================================
-- FASE 4: AUTOMATIC ONBOARDING (Trigger-based)
-- ============================================================================
-- Objetivo: Garantizar que todo nuevo usuario tenga una empresa por defecto.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER AS $$
DECLARE
    new_company_id UUID;
    company_name TEXT;
BEGIN
    -- 1. Idempotencia: Verificar si el usuario ya tiene alguna membresía
    IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- 2. Determinar nombre de la empresa (usar el nombre del usuario o fallback)
    company_name := COALESCE(NEW.full_name, 'Mi Empresa');

    -- 3. Crear la Empresa
    -- Nota: Usamos un slug generado para evitar colisiones iniciales
    INSERT INTO public.companies (name, slug, subscription_status, subscription_tier)
    VALUES (
        company_name, 
        'empresa-' || lower(encode(gen_random_bytes(4), 'hex')), 
        'trialing', 
        'starter'
    )
    RETURNING id INTO new_company_id;

    -- 4. Crear la Membresía como Owner
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'owner');

    -- 5. Establecer como empresa por defecto para el usuario
    -- Esto permite que App.tsx cargue los datos inmediatamente
    UPDATE public.users
    SET default_company_id = new_company_id
    WHERE id = NEW.id;

    RAISE NOTICE 'Automatic onboarding completed for user: % (Company: %)', NEW.id, new_company_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger se dispara DESPUÉS de que se crea el perfil en public.users
-- (que a su vez es creado por el trigger de auth.users).
DROP TRIGGER IF EXISTS trg_user_onboarding ON public.users;
CREATE TRIGGER trg_user_onboarding
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_onboarding();
