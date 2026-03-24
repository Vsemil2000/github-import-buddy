import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TelegramUserPayload {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  language_code?: string | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logStep(step: string, details: Record<string, unknown> = {}) {
  console.log(`[telegram-auth] ${step}`, details);
}

function errorResponse(
  status: number,
  step: string,
  error: string,
  details?: Record<string, unknown>
) {
  console.error(`[telegram-auth] ${step}`, { error, ...(details ?? {}) });
  return jsonResponse({ step, error, ...(details ? { details } : {}) }, status);
}

/**
 * Validate Telegram WebApp initData using HMAC-SHA256.
 * See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
async function validateInitData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  params.delete("hash");
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const enc = new TextEncoder();

  // secret_key = HMAC-SHA256("WebAppData", bot_token)
  const secretKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(botToken));

  // calculated_hash = HMAC-SHA256(secret_key, data_check_string)
  const sigKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", sigKey, enc.encode(dataCheckString));

  const calcHash = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return calcHash === hash;
}

function parseTelegramUser(initData: string, telegramUser?: TelegramUserPayload) {
  const params = new URLSearchParams(initData);
  const rawUser = params.get("user");
  const initDataUser = rawUser ? JSON.parse(rawUser) : {};

  const telegramId = Number(initDataUser.id ?? telegramUser?.telegram_id);
  if (!telegramId) {
    throw new Error("No user in initData");
  }

  if (telegramUser?.telegram_id && telegramUser.telegram_id !== telegramId) {
    throw new Error("Telegram user mismatch");
  }

  return {
    telegram_id: telegramId,
    username: initDataUser.username ?? telegramUser?.username ?? null,
    first_name: initDataUser.first_name ?? telegramUser?.first_name ?? "Telegram User",
    last_name: initDataUser.last_name ?? telegramUser?.last_name ?? null,
    language_code: initDataUser.language_code ?? telegramUser?.language_code ?? null,
  };
}

async function derivePassword(botToken: string, telegramId: number): Promise<string> {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(botToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const pwSig = await crypto.subtle.sign("HMAC", pwKey, enc.encode(`pwd_${telegramId}`));
  return [...new Uint8Array(pwSig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  telegramUser: ReturnType<typeof parseTelegramUser>,
  grantStartingTokens: boolean
) {
  const displayLabel = telegramUser.username
    ? `@${telegramUser.username}`
    : [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ");

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  logStep("profile_lookup_by_user", { userId, profileExists: Boolean(existingProfile) });

  if (!existingProfile) {
    const { error: insertProfileError } = await supabase.from("profiles").insert({
      user_id: userId,
      telegram_id: telegramUser.telegram_id,
      email: displayLabel || null,
    });
    if (insertProfileError) throw insertProfileError;
    logStep("profile_created", { userId, telegramId: telegramUser.telegram_id });
  } else {
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ telegram_id: telegramUser.telegram_id, email: displayLabel || null })
      .eq("user_id", userId);
    if (updateProfileError) throw updateProfileError;
    logStep("profile_updated", { userId, telegramId: telegramUser.telegram_id });
  }

  // Ensure token_wallets entry exists (single source of truth for balance)
  let grantedTokens = false;
  const { data: wallet, error: walletErr } = await supabase
    .from("token_wallets")
    .select("balance, lifetime_credited")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletErr) throw walletErr;

  if (!wallet && grantStartingTokens) {
    const { error: insertWalletErr } = await supabase.from("token_wallets").insert({
      user_id: userId, balance: 5, lifetime_credited: 5, lifetime_spent: 0,
    });
    if (insertWalletErr) throw insertWalletErr;
    grantedTokens = true;
    logStep("wallet_created_with_bonus", { userId });
  } else if (!wallet) {
    const { error: insertWalletErr } = await supabase.from("token_wallets").insert({
      user_id: userId, balance: 0, lifetime_credited: 0, lifetime_spent: 0,
    });
    if (insertWalletErr) throw insertWalletErr;
    logStep("wallet_created_empty", { userId });
  }

  return {
    existed: Boolean(existingProfile),
    created: !existingProfile,
    grantedStartingTokens: grantedTokens,
  };
}

async function ensureStyleProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: existingStyleProfile, error: styleLookupError } = await supabase
    .from("style_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (styleLookupError) throw styleLookupError;

  logStep("style_profile_lookup", {
    userId,
    styleProfileExists: Boolean(existingStyleProfile),
  });

  if (!existingStyleProfile) {
    const { error: insertStyleError } = await supabase.from("style_profiles").insert({
      user_id: userId,
    });

    if (insertStyleError) throw insertStyleError;
    logStep("style_profile_created", { userId });
    return { existed: false, created: true };
  }

  return { existed: true, created: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData, telegramUser } = await req.json();
    console.log("telegram-auth request received", {
      hasInitData: Boolean(initData),
      hasTelegramUser: Boolean(telegramUser),
      telegramUserId: telegramUser?.telegram_id ?? null,
      telegramUsername: telegramUser?.username ?? null,
    });

    if (!initData) {
      return errorResponse(400, "request_validation_failed", "Missing initData");
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const telegramBotToken = TELEGRAM_BOT_TOKEN ?? TELEGRAM_API_KEY;

    if (!telegramBotToken) {
      return errorResponse(
        500,
        "bot_token_missing",
        "Telegram bot token is not configured. Add TELEGRAM_BOT_TOKEN as a project secret."
      );
    }

    logStep("init_data_validation_started", {
      initDataLength: initData.length,
      hasCustomBotToken: Boolean(TELEGRAM_BOT_TOKEN),
      usingConnectorKeyFallback: !TELEGRAM_BOT_TOKEN && Boolean(TELEGRAM_API_KEY),
    });

    const isValid = await validateInitData(initData, telegramBotToken);
    if (!isValid) {
      return errorResponse(
        401,
        "init_data_validation_failed",
        !TELEGRAM_BOT_TOKEN && TELEGRAM_API_KEY
          ? "Telegram initData validation failed. Add TELEGRAM_BOT_TOKEN with the raw bot token because the connector key cannot validate Mini App signatures."
          : "Telegram initData validation failed.",
        {
          telegramUserId: telegramUser?.telegram_id ?? null,
          telegramUsername: telegramUser?.username ?? null,
        }
      );
    }

    const telegramIdentity = parseTelegramUser(initData, telegramUser);
    const telegramId = telegramIdentity.telegram_id;
    console.log("telegram-auth identity parsed", {
      telegramId,
      username: telegramIdentity.username,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const email = `tg_${telegramId}@telegram.local`;
    const password = await derivePassword(telegramBotToken, telegramId);

    const { data: existingProfile, error: existingProfileLookupError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (existingProfileLookupError) {
      return errorResponse(500, "profile_lookup_failed", existingProfileLookupError.message, {
        telegramId,
      });
    }

    logStep("profile_lookup_by_telegram_id", {
      telegramId,
      profileExists: Boolean(existingProfile),
      existingUserId: existingProfile?.user_id ?? null,
    });

    let userId: string;
    let isNewUser = false;

    if (existingProfile) {
      userId = existingProfile.user_id;
      const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramIdentity.telegram_id,
          username: telegramIdentity.username,
          first_name: telegramIdentity.first_name,
          last_name: telegramIdentity.last_name,
          language_code: telegramIdentity.language_code,
        },
      });

      if (updateUserError) {
        return errorResponse(500, "user_update_failed", updateUserError.message, {
          telegramId,
          userId,
        });
      }

      logStep("existing_user_updated", { telegramId, userId });

    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramIdentity.telegram_id,
          username: telegramIdentity.username,
          first_name: telegramIdentity.first_name,
          last_name: telegramIdentity.last_name,
          language_code: telegramIdentity.language_code,
        },
      });

      if (createError) {
        if (createError.message?.includes("already been registered")) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existing = users?.find((u: any) => u.email === email);
          if (existing) {
            userId = existing.id;
            const { error: updateExistingUserError } = await supabase.auth.admin.updateUserById(userId, {
              password,
              email_confirm: true,
              user_metadata: {
                telegram_id: telegramIdentity.telegram_id,
                username: telegramIdentity.username,
                first_name: telegramIdentity.first_name,
                last_name: telegramIdentity.last_name,
                language_code: telegramIdentity.language_code,
              },
            });

            if (updateExistingUserError) {
              return errorResponse(500, "existing_user_recovery_failed", updateExistingUserError.message, {
                telegramId,
                userId,
              });
            }

            logStep("existing_user_recovered_by_email", { telegramId, userId });
          } else {
            return errorResponse(500, "user_create_failed", createError.message, {
              telegramId,
              email,
            });
          }
        } else {
          return errorResponse(500, "user_create_failed", createError.message, {
            telegramId,
            email,
          });
        }
      } else {
        userId = newUser.user!.id;
        isNewUser = true;
        logStep("new_user_created", { telegramId, userId, email });
      }
    }

    const profileResult = await ensureProfile(
      supabase,
      userId,
      telegramIdentity,
      isNewUser || !existingProfile
    );
    const styleProfileResult = await ensureStyleProfile(supabase, userId);

    logStep("bootstrap_complete", {
      telegramId,
      userId,
      profileCreated: profileResult.created,
      styleProfileCreated: styleProfileResult.created,
      grantedStartingTokens: profileResult.grantedStartingTokens,
    });

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);

    const { data: signInData, error: sessionError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !signInData.session || !signInData.user) {
      return errorResponse(500, "session_creation_failed", sessionError?.message ?? "Authentication failed", {
        telegramId,
        userId,
      });
    }

    logStep("session_created", {
      userId: signInData.user.id,
      telegramId,
      isNewUser,
    });

    return jsonResponse({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        user: {
          id: signInData.user.id,
          telegram_id: telegramId,
          username: telegramIdentity.username,
          first_name: telegramIdentity.first_name,
          last_name: telegramIdentity.last_name,
          language_code: telegramIdentity.language_code,
        },
        bootstrap: {
          profileCreated: profileResult.created,
          styleProfileCreated: styleProfileResult.created,
          grantedStartingTokens: profileResult.grantedStartingTokens,
        },
      });
  } catch (err: any) {
    return errorResponse(500, "unexpected_error", err.message, {
      stack: err.stack ?? null,
    });
  }
});
