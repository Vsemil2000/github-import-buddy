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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");

    const userId = claimsData.claims.sub;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Ensure profile exists (no token_balance column)
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: insertError } = await serviceClient.from("profiles").insert({
        user_id: userId,
        free_generation_used: false,
      });
      if (insertError && !insertError.message?.includes("duplicate")) {
        console.error("initialize-user: profile insert error:", insertError);
        // Non-critical — profile may be created by trigger
      }
      console.log("initialize-user: created profile for", userId);
    }

    // Step 2: Ensure token_wallets exists
    const { data: existingWallet } = await serviceClient
      .from("token_wallets")
      .select("id, balance, lifetime_credited")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingWallet) {
      const { error: walletError } = await serviceClient.from("token_wallets").insert({
        user_id: userId,
        balance: WELCOME_BONUS,
        lifetime_credited: WELCOME_BONUS,
        lifetime_spent: 0,
      });
      if (walletError && !walletError.message?.includes("duplicate")) {
        throw walletError;
      }
      console.log("initialize-user: created wallet with", WELCOME_BONUS, "tokens for", userId);
    } else if (existingWallet.lifetime_credited === 0 && existingWallet.balance === 0) {
      const { error: updateError } = await serviceClient
        .from("token_wallets")
        .update({
          balance: WELCOME_BONUS,
          lifetime_credited: WELCOME_BONUS,
        })
        .eq("user_id", userId);
      if (updateError) throw updateError;
      console.log("initialize-user: granted missing welcome bonus for", userId);
    } else {
      console.log("initialize-user: already initialized for", userId,
        "balance:", existingWallet.balance);
      return new Response(JSON.stringify({
        initialized: false,
        reason: "already_initialized",
        tokenBalance: existingWallet.balance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Record welcome bonus transaction
    const { error: txError } = await serviceClient.from("token_transactions").insert({
      user_id: userId,
      amount: WELCOME_BONUS,
      type: "welcome_bonus",
      description: "Welcome bonus — 5 free tokens",
    });
    if (txError && !txError.message?.includes("duplicate")) {
      console.error("initialize-user: tx insert error:", txError.message);
    }

    // Re-read final wallet state
    const { data: finalWallet } = await serviceClient
      .from("token_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const finalBalance = finalWallet?.balance ?? WELCOME_BONUS;
    console.log("initialize-user: completed for", userId, "final balance:", finalBalance);

    return new Response(JSON.stringify({
      initialized: true,
      tokenBalance: finalBalance,
      grantedBonus: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("initialize-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
