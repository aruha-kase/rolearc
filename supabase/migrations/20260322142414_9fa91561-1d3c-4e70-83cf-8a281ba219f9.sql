ALTER TABLE public.scenes
  ADD COLUMN background_brightness double precision NOT NULL DEFAULT 100,
  ADD COLUMN background_saturation double precision NOT NULL DEFAULT 100;