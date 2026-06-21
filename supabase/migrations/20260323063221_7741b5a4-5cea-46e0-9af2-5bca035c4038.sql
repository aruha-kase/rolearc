ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS ambient_brightness double precision NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ambient_saturation double precision NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ambient_color text NOT NULL DEFAULT '#1b3a5c';