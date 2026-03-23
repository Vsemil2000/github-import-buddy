CREATE TABLE public.style_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  primary_style TEXT DEFAULT '',
  secondary_style TEXT DEFAULT '',
  suitable_colors TEXT DEFAULT '',
  avoid_colors TEXT DEFAULT '',
  suitable_cuts TEXT DEFAULT '',
  recommended_hairstyles TEXT DEFAULT '',
  formality_level TEXT DEFAULT '',
  preferred_occasions TEXT DEFAULT '',
  budget_range TEXT DEFAULT '',
  maintenance_level TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own style profile"
  ON public.style_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own style profile"
  ON public.style_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own style profile"
  ON public.style_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add favorite and occasion columns to generated_images
ALTER TABLE public.generated_images 
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS occasion TEXT DEFAULT NULL;