-- 1. Add capacity columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS seat_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS seat_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_increment INTEGER DEFAULT 3;

-- 2. Backfill existing data
UPDATE public.companies
SET seat_limit = 1
WHERE seat_limit IS NULL;

UPDATE public.companies
SET seat_count = 0
WHERE seat_count IS NULL;

-- 3. Create function to sync user count
CREATE OR REPLACE FUNCTION sync_company_user_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update count for the company associated with the new/old user record
  UPDATE public.companies c
  SET seat_count = (
    SELECT COUNT(*)
    FROM public.users u
    WHERE u.default_company_id = c.id
  )
  WHERE c.id = COALESCE(NEW.default_company_id, OLD.default_company_id);

  RETURN NULL;
END;
$$;

-- 4. Create triggers on public.users to maintain seat_count
DROP TRIGGER IF EXISTS trg_user_insert_sync ON public.users;
CREATE TRIGGER trg_user_insert_sync
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_company_user_count();

DROP TRIGGER IF EXISTS trg_user_delete_sync ON public.users;
CREATE TRIGGER trg_user_delete_sync
AFTER DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_company_user_count();

DROP TRIGGER IF EXISTS trg_user_update_sync ON public.users;
CREATE TRIGGER trg_user_update_sync
AFTER UPDATE OF default_company_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_company_user_count();

-- 5. Create RPC validation function (Enforcement Authority)
CREATE OR REPLACE FUNCTION check_environment_capacity(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT seat_limit, seat_count
  INTO v_limit, v_count
  FROM public.companies
  WHERE id = p_company_id;

  -- Default to safe if not found (or handle error)
  IF v_limit IS NULL THEN
    RETURN FALSE; 
  END IF;

  IF v_count >= v_limit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;
