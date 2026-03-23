/**
 * Telegram Mini App authentication.
 *
 * When running inside Telegram, automatically authenticates the user
 * via the backend without showing a login screen.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  getTelegramDiagnostics,
  getTelegramInitData,
  getTelegramUser,
  getTelegramWebApp,
  initTelegramWebApp,
  shouldAttemptTelegramDetection,
  waitForTelegramWebApp,
} from "./telegram";

export interface TelegramAuthDebugState {
  isTelegramWebApp: boolean;
  hasTelegramObject: boolean;
  hasWebAppObject: boolean;
  hasLaunchParams: boolean;
  hasTelegramUserAgent: boolean;
  hasInitData: boolean;
  hasInitDataUnsafe: boolean;
  hasUser: boolean;
  telegramUserId: number | null;
  telegramUsername: string | null;
  initDataLength: number;
  backendRequestStarted: boolean;
  backendResponseSuccess: boolean;
  backendHttpStatus: number | null;
  backendErrorMessage: string | null;
  currentStep: string;
  authSuccess: boolean;
  reason?: string;
}

export interface TelegramAuthResult {
  success: boolean;
  reason?: string;
  debug: TelegramAuthDebugState;
}

let authPromise: Promise<TelegramAuthResult> | null = null;

function buildDebugState(
  overrides: Partial<TelegramAuthDebugState> = {}
): TelegramAuthDebugState {
  const diagnostics = getTelegramDiagnostics();
  const webApp = getTelegramWebApp();
  const initData = webApp?.initData ?? "";

  return {
    ...diagnostics,
    hasInitDataUnsafe: Boolean(webApp?.initDataUnsafe),
    telegramUserId: diagnostics.userId,
    telegramUsername: diagnostics.username,
    initDataLength: initData.length,
    backendRequestStarted: false,
    backendResponseSuccess: false,
    backendHttpStatus: null,
    backendErrorMessage: null,
    currentStep: "idle",
    authSuccess: false,
    reason: undefined,
    ...overrides,
  };
}

function logDebugState(label: string, debug: TelegramAuthDebugState) {
  if (!import.meta.env.DEV) return;

  console.info(`[Telegram Auth] ${label}`, {
    windowTelegramExists: debug.hasTelegramObject,
    windowTelegramWebAppExists: debug.hasWebAppObject,
    isTelegramWebApp: debug.isTelegramWebApp,
    hasTelegramUserAgent: debug.hasTelegramUserAgent,
    hasLaunchParams: debug.hasLaunchParams,
    hasInitData: debug.hasInitData,
    hasInitDataUnsafe: debug.hasInitDataUnsafe,
    hasUser: debug.hasUser,
    telegramUserId: debug.telegramUserId,
    telegramUsername: debug.telegramUsername,
    initDataLength: debug.initDataLength,
    backendRequestStarted: debug.backendRequestStarted,
    backendResponseSuccess: debug.backendResponseSuccess,
    backendHttpStatus: debug.backendHttpStatus,
    backendErrorMessage: debug.backendErrorMessage,
    currentStep: debug.currentStep,
    authSuccess: debug.authSuccess,
    reason: debug.reason,
  });
}

async function requestTelegramAuth(payload: {
  initData: string;
  telegramUser: {
    telegram_id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    language_code: string | null;
  };
}) {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let data: Record<string, unknown> | null = null;

  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = rawBody ? { error: rawBody } : null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

/**
 * Attempt to authenticate via Telegram initData.
 * Returns a structured result so the UI can show graceful fallback states.
 */
export async function authenticateViaTelegram(
  options?: { force?: boolean }
): Promise<TelegramAuthResult> {
  if (!shouldAttemptTelegramDetection()) {
    const debug = buildDebugState({
      reason: "not_telegram",
      currentStep: "telegram_detection_failed",
    });
    logDebugState("Telegram WebApp not detected", debug);
    return { success: false, reason: "not_telegram", debug };
  }

  if (!options?.force && authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    let telegramWebApp;

    try {
      telegramWebApp = await waitForTelegramWebApp();
    } catch (error) {
      const debug = buildDebugState({
        reason: error instanceof Error ? error.message : "sdk_load_failed",
        currentStep: "telegram_sdk_load_failed",
        backendErrorMessage: error instanceof Error ? error.message : "sdk_load_failed",
      });
      logDebugState("Telegram SDK load failed", debug);
      return {
        success: false,
        reason: error instanceof Error ? error.message : "sdk_load_failed",
        debug,
      };
    }

    initTelegramWebApp(telegramWebApp);

    let debug = buildDebugState({ currentStep: "telegram_detected" });
    logDebugState("Detection state", debug);

    if (!debug.hasWebAppObject) {
      debug = buildDebugState({
        reason: "not_telegram",
        currentStep: "telegram_detection_failed",
      });
      logDebugState("Telegram WebApp object missing", debug);
      return { success: false, reason: "not_telegram", debug };
    }

    const telegramUser = getTelegramUser();
    const initData = getTelegramInitData();

    debug = buildDebugState({ currentStep: "telegram_payload_read" });
    logDebugState("Telegram payload snapshot", debug);

    if (!telegramUser) {
      debug = buildDebugState({
        reason: "missing_user",
        currentStep: "user_extraction_failed",
      });
      logDebugState("Telegram user missing", debug);
      return { success: false, reason: "missing_user", debug };
    }

    if (!initData) {
      debug = buildDebugState({
        reason: "missing_init_data",
        currentStep: "init_data_missing",
      });
      logDebugState("Telegram initData missing", debug);
      return { success: false, reason: "missing_init_data", debug };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (Number(session?.user?.user_metadata?.telegram_id) === telegramUser.id) {
      debug = buildDebugState({
        authSuccess: true,
        backendRequestStarted: true,
        backendResponseSuccess: true,
        currentStep: "session_reused",
      });
      logDebugState("Existing Telegram session reused", debug);
      return { success: true, debug };
    }

    try {
      debug = buildDebugState({
        currentStep: "backend_request_started",
        backendRequestStarted: true,
      });
      logDebugState("Telegram backend auth request started", debug);

      const { data, ok, status } = await requestTelegramAuth({
        initData,
        telegramUser: {
          telegram_id: telegramUser.id,
          username: telegramUser.username ?? null,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name ?? null,
          language_code: telegramUser.language_code ?? null,
        },
      });

      if (!ok || !data?.access_token || !data?.refresh_token) {
        const backendErrorMessage =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.details === "string"
              ? data.details
              : `telegram-auth returned HTTP ${status}`;

        console.error("Telegram auth failed:", { status, data });
        debug = buildDebugState({
          reason: backendErrorMessage,
          currentStep: typeof data?.step === "string" ? data.step : "backend_request_failed",
          backendRequestStarted: true,
          backendResponseSuccess: false,
          backendHttpStatus: status,
          backendErrorMessage,
        });
        logDebugState("Telegram auth bridge failed", debug);
        return {
          success: false,
          reason: backendErrorMessage,
          debug,
        };
      }

      debug = buildDebugState({
        currentStep: "backend_response_success",
        backendRequestStarted: true,
        backendResponseSuccess: true,
        backendHttpStatus: status,
      });
      logDebugState("Telegram backend auth response received", debug);

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: String(data.access_token),
        refresh_token: String(data.refresh_token),
      });

      if (sessionError) {
        console.error("Failed to set session:", sessionError);
        debug = buildDebugState({
          reason: sessionError.message,
          currentStep: "session_creation_failed",
          backendRequestStarted: true,
          backendResponseSuccess: true,
          backendHttpStatus: status,
          backendErrorMessage: sessionError.message,
        });
        logDebugState("Failed to persist Telegram session", debug);
        return { success: false, reason: sessionError.message, debug };
      }

      const {
        data: { session: authenticatedSession },
      } = await supabase.auth.getSession();

      const authSuccess = Boolean(authenticatedSession?.user?.id);
      debug = buildDebugState({
        reason: authSuccess ? undefined : "session_not_created",
        currentStep: authSuccess ? "session_created" : "session_creation_failed",
        backendRequestStarted: true,
        backendResponseSuccess: true,
        backendHttpStatus: status,
        authSuccess,
        backendErrorMessage: authSuccess ? null : "session_not_created",
      });

      const userPayload = data.user as { first_name?: string } | undefined;
      console.log("Telegram auth successful for:", userPayload?.first_name);
      logDebugState(authSuccess ? "Telegram auth success" : "Telegram session missing after setSession", debug);

      return {
        success: authSuccess,
        reason: authSuccess ? undefined : "session_not_created",
        debug,
      };
    } catch (err) {
      console.error("Telegram auth error:", err);
      const debug = buildDebugState({
        reason: err instanceof Error ? err.message : "auth_failed",
        currentStep: "backend_request_failed",
        backendRequestStarted: true,
        backendErrorMessage: err instanceof Error ? err.message : "auth_failed",
      });
      logDebugState("Unexpected Telegram auth error", debug);
      return {
        success: false,
        reason: err instanceof Error ? err.message : "auth_failed",
        debug,
      };
    }
  })();

  const result = await authPromise;
  if (!result.success) authPromise = null;
  return result;
}
