-- =============================================================
-- Migration: Support Tickets (Fase 0-B — Entrada de Soporte)
-- =============================================================

-- Tabla principal de tickets de soporte
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Soporte General',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- Índice mínimo viable
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
    ON public.support_tickets (status, created_at DESC);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Los usuarios autenticados pueden crear tickets
CREATE POLICY "users_can_create_tickets"
    ON public.support_tickets FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden ver sus propios tickets
CREATE POLICY "users_can_view_own_tickets"
    ON public.support_tickets FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Super admin ve todos los tickets (para el panel de admin)
-- Esto se maneja con service_role en las consultas admin
