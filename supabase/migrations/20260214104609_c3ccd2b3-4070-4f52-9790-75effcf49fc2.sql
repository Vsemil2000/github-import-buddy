
-- Fix overly permissive RLS policies on payments
DROP POLICY "Service can insert payments" ON public.payments;
DROP POLICY "Service can update payments" ON public.payments;

-- Only authenticated users can insert their own payments (via create-payment edge function)
CREATE POLICY "Users can insert own payments"
ON public.payments FOR INSERT
WITH CHECK (auth.uid() = user_id);
