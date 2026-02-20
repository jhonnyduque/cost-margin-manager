CREATE POLICY company_members_select
ON company_members
FOR SELECT
USING (
  public.is_company_member(company_id)
);