-- ============================================================================
-- VERIFICACIÓN DE FASE 0: FOUNDATION
-- ============================================================================
-- Ejecuta este script en Supabase SQL Editor para verificar
-- que las tablas y triggers se crearon correctamente.
-- ============================================================================

SELECT 'Verificando tablas...' as check_type;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT 'Verificando columnas críticas...' as check_type;

SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name IN ('company_id', 'subscription_status', 'deleted_at', 'role')
ORDER BY table_name, column_name;

SELECT 'Verificando RLS...' as check_type;

SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

SELECT 'Verificando Triggers...' as check_type;

SELECT event_object_table as table_name, trigger_name, event_manipulation as event
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY table_name;
