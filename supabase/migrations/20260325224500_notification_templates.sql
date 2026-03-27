-- =============================================================
-- Migration: Preparación de canales y plantillas (Fase 0-D)
-- =============================================================

-- 1. Ampliar canales en notification_preferences para el futuro
-- (Actualmente solo existe in_app_enabled y email_enabled)
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false NOT NULL;

-- 2. Crear tabla de plantillas de notificación
-- Esto permitirá que en el futuro los mensajes no estén harcodeados en el frontend/backend
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Los canales soportados por este evento
    supports_in_app BOOLEAN DEFAULT true,
    supports_email BOOLEAN DEFAULT false,
    supports_push BOOLEAN DEFAULT false,
    supports_whatsapp BOOLEAN DEFAULT false,
    
    -- Formatos base (usando variables tipo {{productName}})
    in_app_template JSONB DEFAULT '{"title": "", "message": "", "actionUrl": ""}'::jsonb,
    email_template JSONB DEFAULT '{"subject": "", "bodyHtml": ""}'::jsonb,
    push_template JSONB DEFAULT '{"title": "", "body": ""}'::jsonb,
    whatsapp_template TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- RLS para plantillas 
-- Son globales, los usuarios solo pueden leerlas, no editarlas (excepto super_admin si hubiera admin UI)
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "everyone_can_read_templates"
    ON public.notification_templates FOR SELECT
    USING (true);

-- Insertar datos semilla básicos como ejemplo de cómo sería
INSERT INTO public.notification_templates (event_key, name, description, supports_email)
VALUES 
('LOW_STOCK', 'Stock Bajo', 'Alerta cuando un producto baja del inventario mínimo', true),
('COST_DEVIATION', 'Desviación de Costo', 'Alerta cuando hay un cambio drástico en costos', true),
('SYSTEM_ERROR', 'Error del Sistema', 'Error crítico interno', false)
ON CONFLICT (event_key) DO NOTHING;
