ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS crop_top double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crop_right double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crop_bottom double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crop_left double precision DEFAULT 0;