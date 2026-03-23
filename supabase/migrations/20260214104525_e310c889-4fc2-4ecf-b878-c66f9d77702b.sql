
-- Add token_balance and free_generation_used to profiles
ALTER TABLE public.profiles 
ADD COLUMN token_balance integer NOT NULL DEFAULT 0,
ADD COLUMN free_generation_used boolean NOT NULL DEFAULT false;

-- Create payments table
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  yookassa_payment_id text NOT NULL,
  amount numeric(10,2) NOT NULL,
  tokens integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert payments"
ON public.payments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update payments"
ON public.payments FOR UPDATE
USING (true);
