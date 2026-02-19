-- ============================================================================
-- FASE 1: FIX MISSING COLUMNS (PAYLOAD)
-- ============================================================================
-- Descripción: Asegura que la tabla subscription_events tenga la columna payload.
-- Esto es necesario si la tabla fue creada en una versión previa sin esa columna.
-- ============================================================================

DO $$
BEGIN
  -- Agregar columna payload si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_events' AND column_name = 'payload'
  ) THEN
    ALTER TABLE subscription_events ADD COLUMN payload JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added payload column to subscription_events';
  END IF;

  -- Asegurar que sea NOT NULL (opcional, pero buena práctica si ya tiene default)
  -- ALTER TABLE subscription_events ALTER COLUMN payload SET NOT NULL;
END $$;
