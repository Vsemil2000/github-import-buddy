import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;
  let currentOffset: number;

  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;

    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["pre_checkout_query", "message"],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const update of updates) {
      // Handle pre_checkout_query - must answer quickly
      if (update.pre_checkout_query) {
        const query = update.pre_checkout_query;
        console.log("Pre-checkout query:", JSON.stringify(query));

        await fetch(`${GATEWAY_URL}/answerPreCheckoutQuery`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pre_checkout_query_id: query.id,
            ok: true,
          }),
        });
      }

      // Handle successful_payment
      if (update.message?.successful_payment) {
        const payment = update.message.successful_payment;
        console.log("Successful payment:", JSON.stringify(payment));

        try {
          const payload = JSON.parse(payment.invoice_payload);
          const userId = payload.user_id;
          const tokens = payload.tokens;

          if (userId && tokens) {
            // Get current balance
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("token_balance")
              .eq("user_id", userId)
              .single();

            if (profileError) {
              console.error("Profile fetch error:", profileError);
            } else {
              const newBalance = (profile.token_balance || 0) + tokens;
              const { error: updateError } = await supabase
                .from("profiles")
                .update({ token_balance: newBalance })
                .eq("user_id", userId);

              if (updateError) {
                console.error("Balance update error:", updateError);
              } else {
                console.log(`Added ${tokens} tokens to user ${userId}. New balance: ${newBalance}`);
                totalProcessed++;
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse payment payload:", e);
        }
      }
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;

    const { error: offsetErr } = await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (offsetErr) {
      return new Response(JSON.stringify({ error: offsetErr.message }), { status: 500 });
    }

    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});
