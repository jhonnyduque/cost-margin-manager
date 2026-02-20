-- 1. Create Enforcement Function
CREATE OR REPLACE FUNCTION enforce_environment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  -- Get current limit and count for the target company
  SELECT seat_limit, seat_count
  INTO v_limit, v_count
  FROM public.companies
  WHERE id = NEW.default_company_id;

  -- Default to safe if company not found (should not happen with FKs but safety first)
  IF v_limit IS NULL THEN
     -- If no limit defined, we assume strict secure default (or 1)
     -- But here we just proceed if data is missing to avoid locking out due to bugs
     RETURN NEW;
  END IF;

  -- Check if limit is reached
  -- Note: We check >= because adding one more would exceed if we are already at limit
  -- seat_count is used as the current count.
  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'BETO OS: Environment seat limit reached (%/%). Upgrade required.',
      v_count,
      v_limit;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach Trigger to Users Table
DROP TRIGGER IF EXISTS trg_enforce_capacity
ON public.users;

CREATE TRIGGER trg_enforce_capacity
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION enforce_environment_capacity();
