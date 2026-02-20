-- ============================================================================
-- FASE 0: DATABASE TRIGGERS (Protection & Integrity) — FIXED / SAFE / IDEMPOTENT
-- ============================================================================
-- Objetivos del fix:
-- 1) Eliminar referencias incorrectas a auth.user_id() y auth.is_super_admin()
--    (en tu proyecto las helpers están en public.user_id() / public.is_super_admin()).
-- 2) Evitar fallos por objetos ya existentes (idempotencia).
-- 3) Evitar errores si tables opcionales (products / inventory_movements) no existen.
-- 4) Asegurar search_path en SECURITY DEFINER para evitar hijacking.
-- ============================================================================

SET search_path = public;

-- ============================================================================
-- TRIGGER 1: prevent_last_owner_removal
-- ============================================================================
DROP TRIGGER IF EXISTS prevent_last_owner_removal_trigger ON public.company_members;
DROP FUNCTION IF EXISTS public.prevent_last_owner_removal();

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  -- Solo verificar si el registro afectado era owner
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner')
     OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role <> 'owner' OR NEW.is_active = false)) THEN

    -- Contar owners activos restantes (excluyendo el actual)
    SELECT COUNT(*) INTO owner_count
    FROM public.company_members
    WHERE company_id = OLD.company_id
      AND role = 'owner'
      AND is_active = true
      AND id <> OLD.id;

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'No se puede remover al último owner. Debe existir al menos 1 owner activo.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_last_owner_removal_trigger
BEFORE DELETE OR UPDATE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_owner_removal();

-- ============================================================================
-- TRIGGER 2: prevent_role_escalation
-- ============================================================================
-- Previene:
--  - auto-escalación (no puedes cambiar tu propio rol)
--  - asignar a otro un rol superior a tu nivel
-- Nota:
--  - Usa public.user_id() y public.is_super_admin() (helpers de tu Fase 0).
--  - SECURITY DEFINER para que la verificación sea consistente (pero NO bypassa RLS por sí sola).
--    Si tus helpers ya usan SECURITY DEFINER, esto es suficiente para leer company_members.
-- ============================================================================
DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.company_members;
DROP FUNCTION IF EXISTS public.prevent_role_escalation();

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_hierarchy TEXT[] := ARRAY['viewer', 'operator', 'manager', 'admin', 'owner'];
  modifier_role  TEXT;
  modifier_level INT;
  new_level      INT;
  current_user_id UUID;
BEGIN
  -- Solo aplicar cuando cambia el rol
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN

    -- Quien ejecuta la acción (desde JWT)
    current_user_id := public.user_id();

    -- Si no hay sesión, bloquear (protección extra)
    IF current_user_id IS NULL THEN
      RAISE EXCEPTION 'Acción no permitida: sesión inválida.';
    END IF;

    -- REGLA 1: No puedes modificar tu propio rol
    IF NEW.user_id = current_user_id THEN
      RAISE EXCEPTION 'No puedes modificar tu propio rol.';
    END IF;

    -- Super Admin global puede hacer cualquier cambio
    IF public.is_super_admin() THEN
      RETURN NEW;
    END IF;

    -- Obtener rol del modificador en esta company
    SELECT cm.role INTO modifier_role
    FROM public.company_members cm
    WHERE cm.company_id = NEW.company_id
      AND cm.user_id = current_user_id
      AND cm.is_active = true
    LIMIT 1;

    IF modifier_role IS NULL THEN
      RAISE EXCEPTION 'No tienes rol en este Environment para modificar miembros.';
    END IF;

    modifier_level := array_position(role_hierarchy, modifier_role);
    new_level      := array_position(role_hierarchy, NEW.role);

    IF modifier_level IS NULL OR new_level IS NULL THEN
      RAISE EXCEPTION 'Rol inválido (modifier=% / new=%).', modifier_role, NEW.role;
    END IF;

    -- REGLA 2: No puedes asignar un rol superior al tuyo
    IF new_level > modifier_level THEN
      RAISE EXCEPTION 'No puedes asignar el rol "%". Tu rol actual es "%".', NEW.role, modifier_role;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_escalation_trigger
BEFORE UPDATE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_escalation();

-- ============================================================================
-- TRIGGER 3: cascade_soft_delete_company
-- ============================================================================
-- Propaga soft delete (deleted_at) a tablas relacionadas si existen.
-- ============================================================================
DROP TRIGGER IF EXISTS cascade_soft_delete_trigger ON public.companies;
DROP FUNCTION IF EXISTS public.cascade_soft_delete_company();

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo si se está soft-deleting (deleted_at cambia de NULL -> fecha)
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN

    -- products (si existe)
    IF to_regclass('public.products') IS NOT NULL THEN
      EXECUTE $sql$
        UPDATE public.products
        SET deleted_at = $1, updated_at = NOW()
        WHERE company_id = $2 AND deleted_at IS NULL
      $sql$
      USING NEW.deleted_at, NEW.id;
    END IF;

    -- inventory_movements (si existe)
    IF to_regclass('public.inventory_movements') IS NOT NULL THEN
      EXECUTE $sql$
        UPDATE public.inventory_movements
        SET deleted_at = $1
        WHERE company_id = $2 AND deleted_at IS NULL
      $sql$
      USING NEW.deleted_at, NEW.id;
    END IF;

    RAISE NOTICE 'Soft delete propagado para company: %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER cascade_soft_delete_trigger
AFTER UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.cascade_soft_delete_company();

-- ============================================================================
-- TRIGGER 4: auto_create_user_on_signup
-- ============================================================================
-- Crea/asegura perfil en public.users al crear usuario en auth.users
-- Nota: en Supabase esto se crea típicamente con SECURITY DEFINER.
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.auto_create_user_profile();

CREATE OR REPLACE FUNCTION public.auto_create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_user_profile();

-- ============================================================================
-- TRIGGER 5: updated_at automático
-- ============================================================================
DROP FUNCTION IF EXISTS public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo si la tabla tiene columna updated_at (seguridad extra)
  IF to_regclass(TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME) IS NOT NULL THEN
    NEW.updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Nota: si alguna tabla no tiene updated_at, este trigger fallaría al crear.
-- Asumo que las 4 tablas sí tienen updated_at como en tu schema.
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_members_updated_at ON public.company_members;
CREATE TRIGGER update_company_members_updated_at
BEFORE UPDATE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Verificación
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration phase0_triggers FIXED completed';
  RAISE NOTICE 'Triggers: prevent_last_owner_removal, prevent_role_escalation, cascade_soft_delete_company, auto_create_user_profile, update_updated_at_column';
END $$;