-- Migrate se_tracks from scene-scoped to room-scoped

-- 1. Add room_id column
ALTER TABLE public.se_tracks ADD COLUMN room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;

-- 2. Backfill room_id from scenes
UPDATE public.se_tracks
SET room_id = scenes.room_id
FROM scenes
WHERE scenes.id = se_tracks.scene_id;

-- 3. Make room_id NOT NULL (all rows should be populated now)
ALTER TABLE public.se_tracks ALTER COLUMN room_id SET NOT NULL;

-- 4. Drop scene_id
ALTER TABLE public.se_tracks DROP COLUMN scene_id;

-- 5. Replace RLS policies with room-based equivalents
DROP POLICY "Admin can create se_tracks" ON public.se_tracks;
DROP POLICY "Admin can delete se_tracks" ON public.se_tracks;
DROP POLICY "Admin can update se_tracks" ON public.se_tracks;

CREATE POLICY "Admin can create se_tracks" ON public.se_tracks
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = se_tracks.room_id AND r.admin_id = auth.uid())
  );

CREATE POLICY "Admin can delete se_tracks" ON public.se_tracks
  FOR DELETE TO public
  USING (
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = se_tracks.room_id AND r.admin_id = auth.uid())
  );

CREATE POLICY "Admin can update se_tracks" ON public.se_tracks
  FOR UPDATE TO public
  USING (
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = se_tracks.room_id AND r.admin_id = auth.uid())
  );
