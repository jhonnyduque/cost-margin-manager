-- =============================================================================
-- Migración: 20260304170000_notification_system_v1_3.sql
-- Sistema de Notificaciones & Event Bus BETO OS - Versión 1.3
-- =============================================================================

-- 1. Función Helper: current_company()
-- Retorna el ID de la empresa en contexto para RLS.
CREATE OR REPLACE FUNCTION public.current_company()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid;
$$;

-- 2. Tabla: event_bus
CREATE TABLE public.event_bus (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   uuid          REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id      uuid          REFERENCES auth.users(id) ON DELETE CASCADE,
    event_key    text          NOT NULL,
    source_module text         NOT NULL,
    payload      jsonb         DEFAULT '{}'::jsonb,
    created_at   timestamptz   DEFAULT now() NOT NULL
);

-- 3. Tabla: notifications
CREATE TABLE public.notifications (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid          REFERENCES auth.users(id) ON DELETE CASCADE,     -- Puede ser NULL si es para toda la compañía
    company_id   uuid          REFERENCES public.companies(id) ON DELETE CASCADE,
    event_key    text          NOT NULL,
    target_scope text          NOT NULL CHECK (target_scope IN ('user', 'company', 'global')),
    level        text          NOT NULL CHECK (level IN ('info', 'warning', 'error')),
    title        text          NOT NULL,
    message      text          NOT NULL,
    action_url   text,
    data         jsonb         DEFAULT '{}'::jsonb,
    read_at      timestamptz,
    created_at   timestamptz   DEFAULT now() NOT NULL
);

-- 4. Tabla: notification_preferences
CREATE TABLE public.notification_preferences (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid          REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_key       text          NOT NULL,
    in_app_enabled  boolean       DEFAULT true NOT NULL,
    email_enabled   boolean       DEFAULT false NOT NULL,
    created_at      timestamptz   DEFAULT now() NOT NULL,
    UNIQUE(user_id, event_key)
);

-- =============================================================================
-- RLS & SECURITY
-- =============================================================================

ALTER TABLE public.event_bus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- EVENT BUS POLICIES
CREATE POLICY "users_select_company_events"
    ON public.event_bus FOR SELECT
    USING (
        company_id = public.current_company()
        OR (SELECT public.is_super_admin())
    );

CREATE POLICY "service_insert_events"
    ON public.event_bus FOR INSERT
    WITH CHECK (true);

-- NOTIFICATIONS POLICIES
CREATE POLICY "users_select_notifications"
    ON public.notifications FOR SELECT
    USING (
        user_id = auth.uid()
        OR (
            target_scope = 'company' 
            AND company_id IN (SELECT public.user_companies())
        )
        OR target_scope = 'global'
    );

CREATE POLICY "users_update_own_notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_insert_notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- PREFERENCES POLICIES
CREATE POLICY "users_manage_own_preferences"
    ON public.notification_preferences FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Indices para performance
CREATE INDEX idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX idx_event_bus_company ON public.event_bus (company_id, created_at DESC);
