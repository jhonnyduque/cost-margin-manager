-- Phase 10 Patch: Fix Super Admin RLS Access
-- Goal: Ensure 'is_super_admin' in public.users is synced to auth.users.raw_app_meta_data
-- This allows the is_super_admin() RLS function (which reads JWT/metadata) to return TRUE.

-- 1. Create Sync Function
CREATE OR REPLACE FUNCTION public.sync_super_admin_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users metadata
  -- We use SECURITY DEFINER to allow updating auth schema
  UPDATE auth.users
  SET raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('is_super_admin', NEW.is_super_admin)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Triggers on public.users
DROP TRIGGER IF EXISTS on_user_super_admin_change ON public.users;
CREATE TRIGGER on_user_super_admin_change
  AFTER UPDATE OF is_super_admin ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_super_admin_status();

DROP TRIGGER IF EXISTS on_user_super_admin_insert ON public.users;
CREATE TRIGGER on_user_super_admin_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_super_admin_status();

-- 3. One-time fix for existing users (like jhonnydp78@gmail.com)
DO $$
DECLARE
  u record;
BEGIN
  FOR u IN SELECT * FROM public.users WHERE is_super_admin = true LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_super_admin": true}'
    WHERE id = u.id;
    RAISE NOTICE 'Fixed Super Admin metadata for user: %', u.email;
  END LOOP;
END $$;
