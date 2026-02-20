-- ============================================================================
-- FASE 2: CRITICAL RLS FIX (Eliminación de Recursión)
-- ============================================================================
-- Objetivo: Optimizar is_super_admin para que no consulte tablas de dominio.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  -- Leemos directamente de app_metadata en el JWT
  -- Esto evita cualquier SELECT sobre la tabla 'users' durante la evaluación de RLS
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$ LANGUAGE SQL STABLE;

-- Verificación de ayuda para user_id (usando la nativa de Supabase si es posible)
CREATE OR REPLACE FUNCTION public.user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL STABLE;

-- Comentario: Las funciones que usan SECURITY DEFINER (como user_companies) 
-- son seguras frente a recursión infinita siempre que el owner (postgres) 
-- tenga el bypassrls habilitado (comportamiento por defecto en Supabase).
-- Sin embargo, is_super_admin se usa en CASI todas las policies, por lo que
-- moverlo a JWT es la mejora de performance más crítica.
