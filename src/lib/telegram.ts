/**
 * Telegram Mini App (WebApp SDK) helpers.
 *
 * Safe to import anywhere — all calls are no-ops when running
 * outside the Telegram in-app browser.
 */

export interface TelegramDiagnostics {
  hasTelegramObject: boolean;
  hasWebAppObject: boolean;
  hasLaunchParams: boolean;
  hasTelegramUserAgent: boolean;
  isTelegramWebApp: boolean;
  hasInitData: boolean;
  hasUser: boolean;
  userId: number | null;
  username: string | null;
}

const TELEGRAM_WEB_APP_SCRIPT_ID = "telegram-web-app-sdk";
const TELEGRAM_WEB_APP_SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

let telegramWebAppScriptPromise: Promise<void> | null = null;

/** Reference to the WebApp object (undefined outside Telegram). */
export function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}

function hasTelegramLaunchParams(): boolean {
  if (typeof window === "undefined") return false;

  const rawLocation = `${window.location.search}${window.location.hash}`;
  return /tgWebApp/i.test(rawLocation);
}

function hasTelegramUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /telegram/i.test(navigator.userAgent);
}

export function getTelegramDiagnostics(): TelegramDiagnostics {
  const webApp = getTelegramWebApp();
  const user = webApp?.initDataUnsafe?.user;
  const hasTelegramObject = typeof window !== "undefined" && !!window.Telegram;
  const hasWebAppObject = !!webApp;
  const hasLaunchParams = hasTelegramLaunchParams();
  const hasTelegramUserAgentValue = hasTelegramUserAgent();
  const hasInitData = !!webApp?.initData;
  const hasUser = !!user;

  return {
    hasTelegramObject,
    hasWebAppObject,
    hasLaunchParams,
    hasTelegramUserAgent: hasTelegramUserAgentValue,
    isTelegramWebApp:
      hasWebAppObject && (hasInitData || hasUser || hasLaunchParams || hasTelegramUserAgentValue),
    hasInitData,
    hasUser,
    userId: user?.id ?? null,
    username: user?.username ?? null,
  };
}

/** Whether the app is running inside a Telegram Mini App. */
export function isTelegramMiniApp(): boolean {
  return getTelegramDiagnostics().isTelegramWebApp;
}

/** Whether the app should wait for Telegram WebApp injection before falling back. */
export function shouldAttemptTelegramDetection(): boolean {
  const diagnostics = getTelegramDiagnostics();
  return (
    diagnostics.isTelegramWebApp ||
    diagnostics.hasLaunchParams ||
    diagnostics.hasTelegramUserAgent
  );
}

export async function ensureTelegramWebAppScript(): Promise<void> {
  if (typeof document === "undefined") return;
  if (getTelegramWebApp()) return;

  if (telegramWebAppScriptPromise) {
    return telegramWebAppScriptPromise;
  }

  telegramWebAppScriptPromise = new Promise<void>((resolve, reject) => {
    const markLoaded = (script: HTMLScriptElement) => {
      script.dataset.loaded = "true";
      resolve();
    };

    const failLoad = () => {
      telegramWebAppScriptPromise = null;
      reject(new Error("Failed to load Telegram WebApp SDK"));
    };

    const existingScript = document.getElementById(
      TELEGRAM_WEB_APP_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => markLoaded(existingScript), { once: true });
      existingScript.addEventListener("error", failLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TELEGRAM_WEB_APP_SCRIPT_ID;
    script.src = TELEGRAM_WEB_APP_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => markLoaded(script), { once: true });
    script.addEventListener("error", failLoad, { once: true });
    document.head.appendChild(script);
  });

  return telegramWebAppScriptPromise;
}

/** Telegram Mini App user (undefined when unavailable). */
export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user;
}

/** Signed initData payload provided by Telegram. */
export function getTelegramInitData(): string | undefined {
  return getTelegramWebApp()?.initData || undefined;
}

export async function waitForTelegramWebApp(options?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<TelegramWebApp | undefined> {
  const timeoutMs = options?.timeoutMs ?? 2500;
  const pollIntervalMs = options?.pollIntervalMs ?? 120;

  let telegramWebApp = getTelegramWebApp();
  if (telegramWebApp) return telegramWebApp;
  if (!shouldAttemptTelegramDetection()) return undefined;

  await ensureTelegramWebAppScript();

  const startedAt = Date.now();
  while (!telegramWebApp && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
    telegramWebApp = getTelegramWebApp();
  }

  return telegramWebApp;
}

function getThemeColor(variableName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  return value ? `hsl(${value})` : fallback;
}

/**
 * Initialise the Telegram Mini App context.
 * Call once at app startup (e.g. in main.tsx).
 */
export function initTelegramWebApp(webApp = getTelegramWebApp()): void {
  const tg = webApp;
  if (!tg) return;

  // Expand to full available height
  tg.expand();

  // Signal the platform that the app is ready
  tg.ready();

  // Prevent iOS rubber-band / bounce scroll
  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  }

  // Match header & background to app palette
  try {
    const backgroundColor = getThemeColor("--background", "#e5ddd4");
    tg.setHeaderColor(backgroundColor);
    tg.setBackgroundColor(backgroundColor);
  } catch {
    // Older SDK versions may not support these methods
  }
}
