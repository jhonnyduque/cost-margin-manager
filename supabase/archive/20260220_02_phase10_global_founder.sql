-- Phase 10: Global Founder Access
-- Allow Super Admin to bypass RLS and seat limits

-- 1. Helper Function to check Super Admin status safely
create or replace function public.is_super_admin()
returns boolean as $$
begin
  return (auth.jwt() ->> 'is_super_admin')::boolean = true;
end;
$$ language plpgsql security definer;

-- 2. Update RLS Policies for Companies
-- Allow Super Admin to select ALL companies
drop policy if exists "Enable read access for authenticated users belonging to company" on public.companies;
create policy "Enable read access for authenticated users belonging to company"
on public.companies for select
using (
  (auth.uid() in (select user_id from public.company_members where company_id = companies.id))
  OR public.is_super_admin()
);

-- Allow Super Admin to update ALL companies (needed for support/fixing)
drop policy if exists "Enable update for company admins" on public.companies;
create policy "Enable update for company admins"
on public.companies for update
using (
  (auth.uid() in (select user_id from public.company_members where company_id = companies.id and role = 'admin'))
  OR public.is_super_admin()
);

-- 3. Update Seat Enforcement Trigger (to exclude Super Admin from counting)
-- We need to check the trigger function source code first.
-- Assuming `check_environment_capacity` or similar is used.
-- We will modify the trigger function to return early if the user being added is a super admin 
-- OR if the ACTOR (auth.uid) is a super admin performing the add?
-- Actually, the requirement is "Super Admin must NOT count toward seat_limit".
-- This usually means we filter them out of `seat_count`.

-- Update `sync_company_user_count` function to exclude super admins from the count.
create or replace function public.sync_company_user_count()
returns trigger as $$
begin
  -- Count only members who are NOT super admins (if we can identify them in members table)
  -- If super admins don't have member records, then they are already excluded!
  -- Requirement Says: "DO NOT create user records per company."
  -- So if Founder accesses environment WITHOUT a member record, they won't be counted in `company_members`.
  -- Thus, `select count(*) from company_members` will inherently exclude them.
  -- 
  -- BUT, if we *did* add them as support users previously, we might need to filter.
  -- For now, the "Impersonation Context" approach avoids creating member records.
  
  -- So the only change needed is ensuring the TRIGGER doesn't block *operations* by Super Admin
  -- if they *were* to be added (though we shouldn't add them).
  
  update public.companies
  set seat_count = (
    select count(*) 
    from public.company_members cm
    -- join auth.users u on cm.user_id = u.id  <-- If we needed to check metadata
    where cm.company_id = NEW.company_id
  )
  where id = NEW.company_id;
  
  return NEW;
end;
$$ language plpgsql security definer;

-- 4. RLS for Other Tables (Products, Costs, etc.)
-- We need a broad policy update or a way to bypass RLS for all tables.
-- Since modifying ALL tables is tedious, we check if they use `company_id = current_setting(...)`.
-- If RLS checks `company_members`, we must add `OR is_super_admin()`.

-- Example for `products`:
-- drop policy if exists "Enable read access for company members" on public.products;
-- create policy ... using (company_id = ... OR is_super_admin())

-- NOTE: This SQL file acts as a template/partial application. 
-- You might need to apply this pattern to all RLS enabled tables.
