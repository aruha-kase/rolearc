
ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS object_category text DEFAULT 'scene_object',
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flip_x boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_variant_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autoplay boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loop boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS play_on_scene boolean DEFAULT false;
