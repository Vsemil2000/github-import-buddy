-- Change default token_balance to 5 for new users
ALTER TABLE public.profiles ALTER COLUMN token_balance SET DEFAULT 5;

-- Give existing users 5 tokens (only those with 0)
UPDATE public.profiles SET token_balance = 5 WHERE token_balance = 0;

-- Update the handle_new_user function to set 5 tokens
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, token_balance)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'email', 5);
  RETURN NEW;
END;
$function$;