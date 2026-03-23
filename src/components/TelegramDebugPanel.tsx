import type { TelegramAuthDebugState } from "@/lib/telegram-auth";

interface TelegramDebugPanelProps {
  debug: TelegramAuthDebugState | null;
  isChecking: boolean;
}

function toStatusLabel(value: boolean | null | undefined) {
  return value ? "yes" : "no";
}

const TelegramDebugPanel = ({ debug, isChecking }: TelegramDebugPanelProps) => {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs rounded-xl border border-border bg-card/95 p-3 text-xs text-card-foreground shadow-lg backdrop-blur-sm">
      <div className="space-y-1.5">
        <p className="font-semibold">Telegram debug</p>
        <p>Telegram detected: {toStatusLabel(debug?.isTelegramWebApp ?? null)}</p>
        <p>window.Telegram: {toStatusLabel(debug?.hasTelegramObject ?? null)}</p>
        <p>Telegram user found: {toStatusLabel(debug?.hasUser ?? null)}</p>
        <p>Auth success: {toStatusLabel(debug?.authSuccess ?? null)}</p>
        <p>WebApp object: {toStatusLabel(debug?.hasWebAppObject ?? null)}</p>
        <p>User agent hint: {toStatusLabel(debug?.hasTelegramUserAgent ?? null)}</p>
        <p>Init data: {toStatusLabel(debug?.hasInitData ?? null)}</p>
        <p>InitDataUnsafe: {toStatusLabel(debug?.hasInitDataUnsafe ?? null)}</p>
        <p>InitData length: {debug?.initDataLength ?? 0}</p>
        <p>User ID: {debug?.telegramUserId ?? "—"}</p>
        <p>Username: {debug?.telegramUsername ?? "—"}</p>
        <p>Backend request: {toStatusLabel(debug?.backendRequestStarted ?? null)}</p>
        <p>Backend response: {toStatusLabel(debug?.backendResponseSuccess ?? null)}</p>
        <p>HTTP status: {debug?.backendHttpStatus ?? "—"}</p>
        <p>Step: {isChecking ? "checking" : debug?.currentStep ?? "idle"}</p>
        <p>Error: {debug?.backendErrorMessage ?? debug?.reason ?? "—"}</p>
      </div>
    </div>
  );
};

export default TelegramDebugPanel;