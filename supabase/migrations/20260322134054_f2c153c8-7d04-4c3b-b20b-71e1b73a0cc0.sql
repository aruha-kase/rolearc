
CREATE TABLE public.room_assets (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'unnamed',
  url text NOT NULL,
  category text NOT NULL DEFAULT 'object',
  file_size bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.room_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room_assets" ON public.room_assets FOR SELECT USING (true);

CREATE POLICY "Admin can create room_assets" ON public.room_assets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_assets.room_id AND rooms.admin_id = auth.uid()));

CREATE POLICY "Admin can update room_assets" ON public.room_assets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_assets.room_id AND rooms.admin_id = auth.uid()));

CREATE POLICY "Admin can delete room_assets" ON public.room_assets FOR DELETE
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_assets.room_id AND rooms.admin_id = auth.uid()));
