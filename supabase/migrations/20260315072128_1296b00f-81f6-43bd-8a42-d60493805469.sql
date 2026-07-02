
-- Allow anyone (including anonymous/viewer) to update objects
DROP POLICY IF EXISTS "Authenticated can update objects" ON public.objects;
CREATE POLICY "Anyone can update objects" ON public.objects FOR UPDATE USING (true);
