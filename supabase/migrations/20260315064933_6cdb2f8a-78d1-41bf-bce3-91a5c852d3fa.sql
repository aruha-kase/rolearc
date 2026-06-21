
-- SE tracks table (per scene)
CREATE TABLE public.se_tracks (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'SE',
  url TEXT NOT NULL,
  volume DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.se_tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can view
CREATE POLICY "Anyone can view se_tracks" ON public.se_tracks
  FOR SELECT TO public USING (true);

-- Admin can insert
CREATE POLICY "Admin can create se_tracks" ON public.se_tracks
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes s JOIN rooms r ON r.id = s.room_id
      WHERE s.id = se_tracks.scene_id AND r.admin_id = auth.uid()
    )
  );

-- Admin can delete
CREATE POLICY "Admin can delete se_tracks" ON public.se_tracks
  FOR DELETE TO public
  USING (
    EXISTS (
      SELECT 1 FROM scenes s JOIN rooms r ON r.id = s.room_id
      WHERE s.id = se_tracks.scene_id AND r.admin_id = auth.uid()
    )
  );

-- Admin can update
CREATE POLICY "Admin can update se_tracks" ON public.se_tracks
  FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1 FROM scenes s JOIN rooms r ON r.id = s.room_id
      WHERE s.id = se_tracks.scene_id AND r.admin_id = auth.uid()
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.se_tracks;
