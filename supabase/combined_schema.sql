-- RoleArc 統合スキーマ（新規Supabaseプロジェクト用）
-- supabase.com > SQL Editor で実行してください

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- share_token のデフォルト生成（gen_random_bytes）に必要
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- テーブル作成
-- ============================================================

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'メインルーム',
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_scene_id UUID,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_on_break BOOLEAN NOT NULL DEFAULT false,
  scenario JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '新しいシーン',
  background_url TEXT,
  sub_background_url TEXT,
  order_index INT DEFAULT 0,
  background_blur DOUBLE PRECISION NOT NULL DEFAULT 0,
  background_brightness DOUBLE PRECISION NOT NULL DEFAULT 100,
  background_saturation DOUBLE PRECISION NOT NULL DEFAULT 100,
  scene_effect TEXT NOT NULL DEFAULT 'none',
  ambient_brightness DOUBLE PRECISION NOT NULL DEFAULT 100,
  ambient_saturation DOUBLE PRECISION NOT NULL DEFAULT 100,
  ambient_color TEXT NOT NULL DEFAULT '#1b3a5c',
  ambient_blend_mode TEXT NOT NULL DEFAULT 'multiply',
  ambient_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.25,
  bgm_track_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'url_image', 'video', 'embed_object', 'iframe_object')),
  name TEXT NOT NULL DEFAULT 'オブジェクト',
  url TEXT NOT NULL,
  x FLOAT8 DEFAULT 0,
  y FLOAT8 DEFAULT 0,
  width FLOAT8 DEFAULT 300,
  height FLOAT8 DEFAULT 300,
  z_index INT DEFAULT 1,
  is_visible BOOLEAN DEFAULT true,
  object_category TEXT DEFAULT 'scene_object',
  is_locked BOOLEAN DEFAULT false,
  flip_x BOOLEAN DEFAULT false,
  display_name TEXT,
  variants JSONB DEFAULT '[]'::jsonb,
  current_variant_index INTEGER DEFAULT 0,
  autoplay BOOLEAN DEFAULT false,
  loop BOOLEAN DEFAULT false,
  muted BOOLEAN DEFAULT true,
  play_on_scene BOOLEAN DEFAULT false,
  crop_top DOUBLE PRECISION DEFAULT 0,
  crop_right DOUBLE PRECISION DEFAULT 0,
  crop_bottom DOUBLE PRECISION DEFAULT 0,
  crop_left DOUBLE PRECISION DEFAULT 0,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bgm_tracks (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'BGM',
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.se_tracks (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'SE',
  url TEXT NOT NULL,
  volume DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.room_assets (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'unnamed',
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'object',
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 外部キー（循環参照のため後付け）
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_current_scene_id_fkey
  FOREIGN KEY (current_scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;

ALTER TABLE public.scenes
  ADD CONSTRAINT scenes_bgm_track_id_fkey
  FOREIGN KEY (bgm_track_id) REFERENCES public.bgm_tracks(id) ON DELETE SET NULL;

-- ============================================================
-- RLS 有効化
-- ============================================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bgm_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.se_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_assets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ポリシー
-- ============================================================

-- rooms
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can update rooms" ON public.rooms FOR UPDATE USING (auth.uid() = admin_id);
CREATE POLICY "Admin can delete rooms" ON public.rooms FOR DELETE USING (auth.uid() = admin_id);

-- scenes
CREATE POLICY "Anyone can view scenes" ON public.scenes FOR SELECT USING (true);
CREATE POLICY "Admin can create scenes" ON public.scenes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can update scenes" ON public.scenes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can delete scenes" ON public.scenes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));

-- objects
CREATE POLICY "Anyone can view objects" ON public.objects FOR SELECT USING (true);
CREATE POLICY "Admin can create objects" ON public.objects FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scenes s JOIN public.rooms r ON r.id = s.room_id
    WHERE s.id = scene_id AND r.admin_id = auth.uid()
  ));
CREATE POLICY "Anyone can update objects" ON public.objects FOR UPDATE USING (true);
CREATE POLICY "Admin can delete objects" ON public.objects FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.scenes s JOIN public.rooms r ON r.id = s.room_id
    WHERE s.id = scene_id AND r.admin_id = auth.uid()
  ));

-- bgm_tracks
CREATE POLICY "Anyone can view bgm_tracks" ON public.bgm_tracks FOR SELECT USING (true);
CREATE POLICY "Admin can create bgm_tracks" ON public.bgm_tracks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can update bgm_tracks" ON public.bgm_tracks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can delete bgm_tracks" ON public.bgm_tracks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));

-- se_tracks
CREATE POLICY "Anyone can view se_tracks" ON public.se_tracks FOR SELECT USING (true);
CREATE POLICY "Admin can create se_tracks" ON public.se_tracks FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.admin_id = auth.uid()));
CREATE POLICY "Admin can update se_tracks" ON public.se_tracks FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.admin_id = auth.uid()));
CREATE POLICY "Admin can delete se_tracks" ON public.se_tracks FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.admin_id = auth.uid()));

-- room_assets
CREATE POLICY "Anyone can view room_assets" ON public.room_assets FOR SELECT USING (true);
CREATE POLICY "Admin can create room_assets" ON public.room_assets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can update room_assets" ON public.room_assets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));
CREATE POLICY "Admin can delete room_assets" ON public.room_assets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND admin_id = auth.uid()));

-- ============================================================
-- Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.objects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bgm_tracks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.se_tracks;

-- 注: 画像・動画・音声ファイルは Cloudflare R2 に保管する（Supabase Storage は未使用）。
-- R2 のセットアップは README を参照。

-- ============================================================
-- トリガー
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON public.objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
