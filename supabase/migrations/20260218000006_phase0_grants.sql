-- ============================================================================
-- FASE 0: FIX PERMISSIONS (GRANTS)
-- ============================================================================
-- Descripción: Otorga permisos de ejecución (CRUD) al rol 'authenticated'.
-- Nota: RLS sigue controlando QUÉ filas pueden ver/tocar, pero necesitan 
-- permiso a nivel de tabla para intentar la operación.
-- Autor: Sistema
-- Fecha: 2026-02-18
-- ============================================================================

-- 1. Permisos sobre Schema Public
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Permisos sobre Tablas existentes (Core + Business)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Permisos sobre Secuencias (para columnas SERIAL o IDENTITY si las hubiera)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Asegurar permisos para futuras tablas (opcional pero recomendado)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260218000006_phase0_grants.sql completed';
  RAISE NOTICE 'Permissions granted to role "authenticated" and "service_role" on public schema.';
END $$;
