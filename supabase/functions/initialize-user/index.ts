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
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service client to verify user via auth.getUser with the token
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Decode JWT to get user ID
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
      if (!userId) throw new Error("No sub in token");
      console.log("initialize-user: userId from JWT:", userId);
    } catch (decodeErr) {
      console.error("initialize-user: JWT decode failed:", decodeErr);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Ensure token_wallets exists
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
      console.log("initialize-user: created wallet with", WELCOME_BONUS, "tokens");

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

      return new Response(JSON.stringify({
        initialized: true,
        tokenBalance: WELCOME_BONUS,
        grantedBonus: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (existingWallet.lifetime_credited === 0 && existingWallet.balance === 0) {
      // Fix missing bonus
      const { error: updateError } = await serviceClient
        .from("token_wallets")
        .update({ balance: WELCOME_BONUS, lifetime_credited: WELCOME_BONUS })
        .eq("user_id", userId);
      if (updateError) {
        console.error("initialize-user: wallet update error:", JSON.stringify(updateError));
        throw updateError;
      }
      console.log("initialize-user: granted missing welcome bonus");

      return new Response(JSON.stringify({
        initialized: true,
        tokenBalance: WELCOME_BONUS,
        grantedBonus: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      console.log("initialize-user: already initialized, balance:", existingWallet.balance);
      return new Response(JSON.stringify({
        initialized: false,
        reason: "already_initialized",
        tokenBalance: existingWallet.balance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("initialize-user error:", e);
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
