-- =============================================================
-- Foundation Cleanup (Fase 0)
-- Objetivo: TTL mínimo para event_bus y notifications
-- =============================================================

-- Índices por created_at para acelerar cleanup
CREATE INDEX IF NOT EXISTS idx_event_bus_created_at ON public.event_bus (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at);

-- Función de limpieza básica
CREATE OR REPLACE FUNCTION public.cleanup_notifications_foundation()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Borrar eventos del bus más antiguos que 72 horas
    DELETE FROM public.event_bus
    WHERE created_at < now() - interval '72 hours';

    -- Borrar notificaciones más antiguas que 30 días
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '30 days';
END;
$$;

-- Nota: programar esta función con la herramienta de scheduler disponible
-- (pg_cron / Supabase Scheduler) a una cadencia diaria.
