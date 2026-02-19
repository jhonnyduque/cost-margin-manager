-- ============================================================================
-- FASE 0: DATABASE TRIGGERS (Protection & Integrity)
-- ============================================================================

-- ============================================================================
-- TRIGGER 1: prevent_last_owner_removal
-- ============================================================================
-- Previene eliminar o desactivar el último owner de una company
CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  -- Solo verificar si es owner
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.is_active = false)) THEN
    
    -- Contar owners activos restantes (excluyendo el actual)
    SELECT COUNT(*) INTO owner_count
    FROM company_members
    WHERE company_id = OLD.company_id 
      AND role = 'owner' 
      AND is_active = true
      AND id != OLD.id;
    
    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of company. At least one active owner is required.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_last_owner_removal_trigger
  BEFORE DELETE OR UPDATE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_owner_removal();

-- ============================================================================
-- TRIGGER 2: prevent_role_escalation (Riesgo Crítico #4)
-- ============================================================================
-- Previene que usuarios escalen su propio rol o roles por encima de su nivel
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  role_hierarchy TEXT[] := ARRAY['viewer', 'operator', 'manager', 'admin', 'owner'];
  modifier_role TEXT;
  modifier_level INT;
  old_level INT;
  new_level INT;
  current_user_id UUID;
BEGIN
  -- Solo aplicar en UPDATE de rol
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    
    -- Obtener el user_id actual (quien hace la modificación)
    current_user_id := auth.user_id();
    
    -- REGLA 1: No puede modificar su propio rol
    IF NEW.user_id = current_user_id THEN
      RAISE EXCEPTION 'Cannot modify your own role. Self-role-escalation is not allowed.';
    END IF;
    
    -- REGLA 2: Solo puede escalar roles hasta su propio nivel (o inferior)
    -- Obtener rol del modificador
    SELECT role INTO modifier_role
    FROM company_members
    WHERE company_id = NEW.company_id 
      AND user_id = current_user_id
      AND is_active = true;
    
    -- Si no se encontró rol (super admin bypasea este check)
    IF modifier_role IS NULL THEN
      -- Verificar si es super admin
      IF NOT auth.is_super_admin() THEN
        RAISE EXCEPTION 'Modifier has no role in this company';
      END IF;
      -- Super admin puede hacer cualquier cambio
      RETURN NEW;
    END IF;
    
    -- Calcular niveles
    modifier_level := array_position(role_hierarchy, modifier_role);
    old_level := array_position(role_hierarchy, OLD.role);
    new_level := array_position(role_hierarchy, NEW.role);
    
    -- Verificar que el nuevo rol no sea superior al del modificador
    IF new_level > modifier_level THEN
      RAISE EXCEPTION 'Cannot escalate role to % (level %). Your role is % (level %).', 
        NEW.role, new_level, modifier_role, modifier_level;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- ============================================================================
-- TRIGGER 3: cascade_soft_delete_company
-- ============================================================================
-- Propaga soft delete de company a tablas relacionadas
CREATE OR REPLACE FUNCTION cascade_soft_delete_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si se está soft-deleting (deleted_at cambia de NULL a fecha)
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    
    -- Soft delete en products (si existe)
    UPDATE products 
    SET deleted_at = NEW.deleted_at, updated_at = NOW()
    WHERE company_id = NEW.id AND deleted_at IS NULL;
    
    -- Soft delete en inventory_movements (si existe)
    UPDATE inventory_movements 
    SET deleted_at = NEW.deleted_at
    WHERE company_id = NEW.id AND deleted_at IS NULL;
    
    RAISE NOTICE 'Soft deleted all data for company: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cascade_soft_delete_trigger
  AFTER UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete_company();

-- ============================================================================
-- TRIGGER 4: auto_create_user_on_signup
-- ============================================================================
-- Crea entrada en users cuando se crea en auth.users
CREATE OR REPLACE FUNCTION auto_create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en auth.users (schema especial de Supabase)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_profile();

-- ============================================================================
-- TRIGGER 5: updated_at automático
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_members_updated_at
  BEFORE UPDATE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verificación
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000004_phase0_triggers.sql completed';
  RAISE NOTICE 'Triggers created: prevent_last_owner_removal, prevent_role_escalation, cascade_soft_delete, auto_create_user_profile, update_updated_at';
END $$;
