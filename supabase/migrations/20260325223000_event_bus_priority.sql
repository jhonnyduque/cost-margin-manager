-- =============================================================
-- Migration: Add priority to Event Bus (Fase 0-C)
-- =============================================================

-- 1. Agregar campo priority a event_bus si no existe
ALTER TABLE public.event_bus 
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium' 
CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- 2. Índice utilitario para consultas por prioridad (opcional pero recomendado para el sistema en el futuro)
CREATE INDEX IF NOT EXISTS idx_event_bus_priority 
ON public.event_bus (priority) 
WHERE priority IN ('high', 'critical');
