
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'メインルーム',
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_scene_id UUID,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '新しいシーン',
  background_url TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'url_image', 'video')),
  name TEXT NOT NULL DEFAULT 'オブジェクト',
  url TEXT NOT NULL,
  x FLOAT8 DEFAULT 0,
  y FLOAT8 DEFAULT 0,
  width FLOAT8 DEFAULT 300,
  height FLOAT8 DEFAULT 300,
  z_index INT DEFAULT 1,
  is_visible BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_current_scene_id_fkey
  FOREIGN KEY (current_scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can update rooms" ON public.rooms FOR UPDATE USING (auth.uid() = admin_id);
CREATE POLICY "Admin can delete rooms" ON public.rooms FOR DELETE USING (auth.uid() = admin_id);

CREATE POLICY "Anyone can view scenes" ON public.scenes FOR SELECT USING (true);
CREATE POLICY "Admin can create scenes" ON public.scenes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can update scenes" ON public.scenes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can delete scenes" ON public.scenes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));

CREATE POLICY "Anyone can view objects" ON public.objects FOR SELECT USING (true);
CREATE POLICY "Admin can create objects" ON public.objects FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scenes s JOIN public.rooms r ON r.id = s.room_id
    WHERE s.id = scene_id AND r.admin_id = auth.uid()
  ));
CREATE POLICY "Authenticated can update objects" ON public.objects FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can delete objects" ON public.objects FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.scenes s JOIN public.rooms r ON r.id = s.room_id
    WHERE s.id = scene_id AND r.admin_id = auth.uid()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.objects;

INSERT INTO storage.buckets (id, name, public) VALUES ('scene-assets', 'scene-assets', true);

CREATE POLICY "Anyone can view scene assets" ON storage.objects FOR SELECT USING (bucket_id = 'scene-assets');
CREATE POLICY "Authenticated users can upload scene assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'scene-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update scene assets" ON storage.objects FOR UPDATE USING (bucket_id = 'scene-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete scene assets" ON storage.objects FOR DELETE USING (bucket_id = 'scene-assets' AND auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON public.scenes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
