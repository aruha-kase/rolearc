
-- BGM tracks table
CREATE TABLE public.bgm_tracks (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'BGM',
  url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bgm_tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can view
CREATE POLICY "Anyone can view bgm_tracks" ON public.bgm_tracks
  FOR SELECT USING (true);

-- Admin can insert
CREATE POLICY "Admin can create bgm_tracks" ON public.bgm_tracks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = bgm_tracks.room_id AND rooms.admin_id = auth.uid())
  );

-- Admin can delete
CREATE POLICY "Admin can delete bgm_tracks" ON public.bgm_tracks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = bgm_tracks.room_id AND rooms.admin_id = auth.uid())
  );

-- Admin can update
CREATE POLICY "Admin can update bgm_tracks" ON public.bgm_tracks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = bgm_tracks.room_id AND rooms.admin_id = auth.uid())
  );

-- Add bgm_track_id to scenes
ALTER TABLE public.scenes ADD COLUMN bgm_track_id uuid REFERENCES public.bgm_tracks(id) ON DELETE SET NULL;
