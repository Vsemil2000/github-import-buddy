
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id bigint UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles (telegram_id);
