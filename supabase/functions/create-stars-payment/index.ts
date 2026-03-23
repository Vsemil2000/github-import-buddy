import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tokens, stars } = await req.json();

    if (!tokens || !stars || tokens < 1 || stars < 1) {
      throw new Error("Invalid package");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    // Create invoice link via Telegram Bot API
    const payload = JSON.stringify({ user_id: user.id, tokens });

    const response = await fetch(`${GATEWAY_URL}/createInvoiceLink`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `AI стилист: ${tokens} токен${tokens === 1 ? "" : tokens < 5 ? "а" : "а"}`,
        description: `Купуване на ${tokens} токен${tokens === 1 ? "" : "а"} за генериране на стилове`,
        payload,
        currency: "XTR",
        prices: [{ label: `${tokens} токен${tokens === 1 ? "" : "а"}`, amount: stars }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Telegram createInvoiceLink error:", response.status, JSON.stringify(data));
      throw new Error(`Telegram API call failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    // data.result is the invoice link URL
    const invoiceLink = data.result;

    return new Response(JSON.stringify({ invoiceLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-stars-payment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
