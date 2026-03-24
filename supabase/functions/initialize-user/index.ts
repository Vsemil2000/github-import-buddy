import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WELCOME_BONUS = 5;

serve(async (req) => {
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

    // Authenticate user via official Supabase auth (same pattern as check-tokens)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("initialize-user: auth failed:", authError?.message ?? "no user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log("initialize-user: userId resolved:", userId);

    // Service client to bypass RLS
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    console.log("initialize-user: existing wallet:", JSON.stringify(existingWallet));

    if (!existingWallet) {
      // Create wallet with welcome bonus
      console.log("initialize-user: creating new wallet with bonus", WELCOME_BONUS);
      const { error: walletError } = await serviceClient.from("token_wallets").insert({
        user_id: userId,
        balance: WELCOME_BONUS,
        lifetime_credited: WELCOME_BONUS,
        lifetime_spent: 0,
      });
      if (walletError) {
        console.error("initialize-user: wallet insert error:", JSON.stringify(walletError));
        if (!walletError.message?.includes("duplicate")) throw walletError;
      }

      // Record transaction
      const { error: txError } = await serviceClient.from("token_transactions").insert({
        user_id: userId,
        amount: WELCOME_BONUS,
        type: "welcome_bonus",
        description: "Welcome bonus — 5 free tokens",
      });
      if (txError) {
        console.error("initialize-user: tx insert error:", JSON.stringify(txError));
      }

      console.log("initialize-user: bonus granted, final balance:", WELCOME_BONUS);
      return new Response(JSON.stringify({
        initialized: true,
        tokenBalance: WELCOME_BONUS,
        grantedBonus: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (existingWallet.lifetime_credited === 0 && existingWallet.balance === 0) {
      // Fix missing bonus for existing wallet with 0/0
      console.log("initialize-user: wallet exists with 0 balance, 0 lifetime_credited — granting missing bonus");
      const { error: updateError } = await serviceClient
        .from("token_wallets")
        .update({ balance: WELCOME_BONUS, lifetime_credited: WELCOME_BONUS })
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

      console.log("initialize-user: missing bonus granted, final balance:", WELCOME_BONUS);
      return new Response(JSON.stringify({
        initialized: true,
        tokenBalance: WELCOME_BONUS,
        grantedBonus: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      console.log("initialize-user: already initialized, balance:", existingWallet.balance, "lifetime_credited:", existingWallet.lifetime_credited);
      return new Response(JSON.stringify({
        initialized: false,
        reason: "already_initialized",
        tokenBalance: existingWallet.balance,
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
