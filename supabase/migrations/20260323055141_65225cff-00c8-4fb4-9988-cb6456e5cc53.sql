
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS scene_effect text NOT NULL DEFAULT 'none';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_on_break boolean NOT NULL DEFAULT false;
