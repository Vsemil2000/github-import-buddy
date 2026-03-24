import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WELCOME_BONUS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("initialize-user: missing env vars");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.slice("Bearer ".length);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log("initialize-user: userId", userId);

    // Check token_wallets only
    const { data: wallet, error: walletErr } = await serviceClient
      .from("token_wallets")
      .select("balance, lifetime_credited")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletErr) {
      console.error("initialize-user: wallet query error", walletErr);
      throw walletErr;
    }

    if (!wallet) {
      // No wallet — create with welcome bonus
      const { error: insertErr } = await serviceClient
        .from("token_wallets")
        .insert({ user_id: userId, balance: WELCOME_BONUS, lifetime_credited: WELCOME_BONUS, lifetime_spent: 0 });

      if (insertErr) {
        console.error("initialize-user: wallet insert error", insertErr);
        throw insertErr;
      }

      await serviceClient.from("token_transactions").insert({
        user_id: userId, amount: WELCOME_BONUS, type: "welcome_bonus",
        description: "Welcome bonus — 5 free tokens",
      });

      console.log("initialize-user: wallet created, balance:", WELCOME_BONUS);
      return new Response(JSON.stringify({ initialized: true, balance: WELCOME_BONUS, grantedBonus: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!wallet.lifetime_credited || wallet.lifetime_credited === 0) {
      // Wallet exists but no bonus yet — grant retroactively
      const newBalance = (wallet.balance ?? 0) + WELCOME_BONUS;
      const { error: updateErr } = await serviceClient
        .from("token_wallets")
        .update({ balance: newBalance, lifetime_credited: WELCOME_BONUS })
        .eq("user_id", userId);

      if (updateErr) throw updateErr;

      await serviceClient.from("token_transactions").insert({
        user_id: userId, amount: WELCOME_BONUS, type: "welcome_bonus",
        description: "Welcome bonus — 5 free tokens (retroactive)",
      });

      console.log("initialize-user: retroactive bonus, balance:", newBalance);
      return new Response(JSON.stringify({ initialized: true, balance: newBalance, grantedBonus: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already initialized
    console.log("initialize-user: already initialized, balance:", wallet.balance);
    return new Response(JSON.stringify({ initialized: false, balance: wallet.balance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("initialize-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
