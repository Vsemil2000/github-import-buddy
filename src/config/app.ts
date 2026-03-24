/**
 * Centralized app configuration.
 *
 * Domain-dependent values live here so the project stays portable
 * across Lovable hosting, custom domains, and self-hosted setups.
 *
 * Override any value via the corresponding VITE_* env var.
 */

/** Production URL – used as the default for auth redirects. */
const PRODUCTION_URL = "https://import-idol.lovable.app";

/** Base URL of the running app (no trailing slash). */
export const APP_BASE_URL: string =
  import.meta.env.VITE_APP_BASE_URL ?? PRODUCTION_URL;

/** Telegram bot deep-link URL. */
export const TELEGRAM_BOT_URL: string =
  import.meta.env.VITE_TELEGRAM_BOT_URL ?? "https://t.me/aistillist_bot";

/** Auth email-redirect URL (where the confirmation link lands). */
export const AUTH_REDIRECT_URL: string =
  import.meta.env.VITE_AUTH_REDIRECT_URL ?? PRODUCTION_URL;
