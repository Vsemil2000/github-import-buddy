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
      console.log("initialize-user: no auth header");
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("initialize-user: request received");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("initialize-user: missing env vars", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });

      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.slice("Bearer ".length);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error("initialize-user: auth failed:", authError?.message ?? "no user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log("initialize-user: userId resolved:", userId);

    // Check existing wallet
    console.log("initialize-user: checking wallet for", userId);
    const { data: existingWallet, error: walletCheckErr } = await serviceClient
      .from("token_wallets")
      .select("id, balance, lifetime_credited")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletCheckErr) {
      console.error("initialize-user: wallet check error:", JSON.stringify(walletCheckErr));
      throw walletCheckErr;
    }

    console.log("initialize-user: wallet existed:", Boolean(existingWallet));
    console.log("initialize-user: lifetime_credited before:", existingWallet?.lifetime_credited ?? 0);

    if (!existingWallet) {
      console.log("initialize-user: bonus applied: create wallet with", WELCOME_BONUS);
      const { data: createdWallet, error: walletError } = await serviceClient
        .from("token_wallets")
        .insert({
        user_id: userId,
        balance: WELCOME_BONUS,
        lifetime_credited: WELCOME_BONUS,
        lifetime_spent: 0,
        })
        .select("balance")
        .maybeSingle();

      if (walletError) {
        console.error("initialize-user: wallet insert error:", JSON.stringify(walletError));
        throw walletError;
      }

      const { error: txError } = await serviceClient.from("token_transactions").insert({
        user_id: userId,
        amount: WELCOME_BONUS,
        type: "welcome_bonus",
        description: "Welcome bonus — 5 free tokens",
      });
      if (txError) {
        console.error("initialize-user: tx insert error:", JSON.stringify(txError));
      }

      const finalBalance = createdWallet?.balance ?? WELCOME_BONUS;
      console.log("initialize-user: final balance:", finalBalance);
      return new Response(JSON.stringify({
        initialized: true,
        tokenBalance: finalBalance,
        grantedBonus: true,
        finalBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (!existingWallet.lifetime_credited || existingWallet.lifetime_credited === 0) {
      const finalBalance = (existingWallet.balance ?? 0) + WELCOME_BONUS;
      console.log("initialize-user: bonus applied: existing wallet updated", {
        previousBalance: existingWallet.balance ?? 0,
        finalBalance,
      });

      const { error: updateError } = await serviceClient
        .from("token_wallets")
        .update({ balance: finalBalance, lifetime_credited: WELCOME_BONUS })
        .eq("user_id", userId);

      if (updateError) {
        console.error("initialize-user: wallet update error:", JSON.stringify(updateError));
        throw updateError;
      }

      const { error: txError } = await serviceClient.from("token_transactions").insert({
        user_id: userId,
        amount: WELCOME_BONUS,
        type: "welcome_bonus",
        description: "Welcome bonus — 5 free tokens (retroactive)",
      });
      if (txError) {
        console.error("initialize-user: tx insert error:", JSON.stringify(txError));
      }

      console.log("initialize-user: final balance:", finalBalance);
      return new Response(JSON.stringify({
        initialized: true,
        tokenBalance: finalBalance,
        grantedBonus: true,
        finalBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      const finalBalance = existingWallet.balance ?? 0;
      console.log("initialize-user: bonus skipped: already initialized");
      console.log("initialize-user: final balance:", finalBalance);
      return new Response(JSON.stringify({
        initialized: false,
        reason: "already_initialized",
        tokenBalance: finalBalance,
        finalBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("initialize-user error:", e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
