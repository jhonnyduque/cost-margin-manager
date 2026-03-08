CREATE TABLE IF NOT EXISTS public.material_tSTS \
Allow
super_admins
to
manage
units_of_measure\ ON public.units_of_measure;
CREATE POLICY \Allow
super_admins
to
manage
units_of_measure\ 
ON public.units_of_measure FOR ALL 
TO authenticated 
USING (public.is_super_admin());
