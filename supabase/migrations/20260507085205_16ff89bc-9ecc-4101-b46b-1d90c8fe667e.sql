DROP POLICY IF EXISTS "Admin can create se_tracks" ON public.se_tracks;
DROP POLICY IF EXISTS "Admin can delete se_tracks" ON public.se_tracks;
DROP POLICY IF EXISTS "Admin can update se_tracks" ON public.se_tracks;

ALTER TABLE public.se_tracks ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;

UPDATE public.se_tracks
SET room_id = scenes.room_id
FROM scenes
WHERE scenes.id = se_tracks.scene_id AND se_tracks.room_id IS NULL;

ALTER TABLE public.se_tracks ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE public.se_tracks DROP COLUMN IF EXISTS scene_id;

CREATE POLICY "Admin can create se_tracks" ON public.se_tracks
  FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM rooms r WHERE r.id = se_tracks.room_id AND r.admin_id = auth.uid()));

CREATE POLICY "Admin can delete se_tracks" ON public.se_tracks
  FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM rooms r WHERE r.id = se_tracks.room_id AND r.admin_id = auth.uid()));

CREATE POLICY "Admin can update se_tracks" ON public.se_tracks
  FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM rooms r WHERE r.id = se_tracks.room_id AND r.admin_id = auth.uid()));