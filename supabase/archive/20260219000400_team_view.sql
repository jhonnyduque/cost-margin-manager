-- ============================================================================
-- MODELO BETO: CANONICAL TEAM ACCESS LAYER
-- ============================================================================

-- Creamos una vista que une la información de membresía, perfil público y auth.
-- NOTA: No usamos security_invoker=true porque necesitamos acceder a auth.users,
-- por lo que implementamos la seguridad manualmente filtrando por las empresas del usuario.
CREATE OR REPLACE VIEW public.team_members_view AS
SELECT 
    cm.id as id,
    cm.company_id,
    cm.user_id,
    cm.role,
    cm.is_active,
    u.full_name,
    u.email,
    au.last_sign_in_at,
    cm.created_at as joined_at,
    au.invited_at,
    au.confirmation_sent_at
FROM public.company_members cm
JOIN public.users u ON u.id = cm.user_id
JOIN auth.users au ON au.id = cm.user_id
WHERE (
    -- Seguridad: Solo ver miembros de empresas a las que el usuario pertenece
    cm.company_id IN (SELECT public.user_companies())
    OR public.is_super_admin()
);

-- Permisos
GRANT SELECT ON public.team_members_view TO authenticated;
GRANT SELECT ON public.team_members_view TO service_role;

-- Comentario informativo
COMMENT ON VIEW public.team_members_view IS 'Capa canónica para acceder a datos de equipo sin acoplamiento directo a esquemas de auth.';
