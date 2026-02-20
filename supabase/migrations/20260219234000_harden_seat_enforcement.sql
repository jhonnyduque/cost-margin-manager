-- 1. Extend Enforcement Function to handle UPDATES
CREATE OR REPLACE FUNCTION enforce_environment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN

  -- Only validate when inserting OR changing environment via UPDATE
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE'
         AND NEW.default_company_id IS DISTINCT FROM OLD.default_company_id)
  THEN

    -- Get capacity info for the NEW company
    SELECT seat_limit, seat_count
    INTO v_limit, v_count
    FROM public.companies
    WHERE id = NEW.default_company_id;
    
    -- Safety check if company doesn't exist or has no limit
    IF v_limit IS NOT NULL THEN
        -- Check if limit is reached
        -- We use >= because seat_count includes the current valid users. 
        -- Attempting to add one more (this transaction) should fail if we are at or above limit.
        IF v_count >= v_limit THEN
          RAISE EXCEPTION
            'BETO OS: Environment seat limit reached (%/%). Upgrade required.',
            v_count,
            v_limit;
        END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- 2. Add Trigger for UPDATE operations
DROP TRIGGER IF EXISTS trg_enforce_capacity_update
ON public.users;

CREATE TRIGGER trg_enforce_capacity_update
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION enforce_environment_capacity();

-- Note: The INSERT trigger (trg_enforce_capacity) should already exist from Phase 7.1
-- If not, it should be created:
-- CREATE TRIGGER trg_enforce_capacity BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION enforce_environment_capacity();
