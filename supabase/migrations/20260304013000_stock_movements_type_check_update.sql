-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Update stock_movements type CHECK constraint
-- Date: 2026-03-04
-- Purpose: Allow 'egreso_asumido' and 'egreso_compensatorio' types for the
--          debt tracking system (Active Protection System).
--
-- BUG FIX: The original CHECK constraint only allowed 'ingreso' and 'egreso'.
--          When producing with insufficient stock, the system correctly creates
--          'egreso_asumido' movements to track technical debt, but the DB
--          constraint silently rejects them, causing the entire batch insert
--          to fail. This results in:
--            - Dashboard showing $0 debt (PROTEGIDO) when debt actually exists
--            - product_movement.produced_with_debt = true but no corresponding
--              stock_movement records for the debt
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop the old constraint
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_check;

-- Add the new constraint with all valid movement types
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_type_check
  CHECK (type = ANY (ARRAY[
    'ingreso'::text,
    'egreso'::text,
    'egreso_asumido'::text,
    'egreso_compensatorio'::text
  ]));

COMMENT ON CONSTRAINT stock_movements_type_check ON public.stock_movements IS
  'Valid movement types: ingreso (purchase), egreso (FIFO consumption), '
  'egreso_asumido (assumed exit when no stock - creates technical debt), '
  'egreso_compensatorio (compensates a previous egreso_asumido)';
