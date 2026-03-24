import { useCallback, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Studio from "./pages/Studio";
import Cabinet from "./pages/Cabinet";
import Dashboard from "./pages/Dashboard";
import AIStylist from "./pages/AIStylist";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { authenticateViaTelegram } from "./lib/telegram-auth";
import type { TelegramAuthDebugState } from "./lib/telegram-auth";
import { shouldAttemptTelegramDetection } from "./lib/telegram";
import TelegramDebugPanel from "@/components/TelegramDebugPanel";

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/studio" element={<Studio />} />
    <Route path="/ai-stylist" element={<AIStylist />} />
    <Route path="/cabinet" element={<Cabinet />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

function getTelegramFallbackMessage(reason?: string): string {
  switch (reason) {
    case "not_telegram":
      return "Не успяхме да засечем Telegram Mini App средата. Отворете приложението от бутона в Telegram.";
    case "missing_user":
      return "Telegram не подаде потребителски данни. Отворете приложението отново през Mini App.";
    case "missing_init_data":
      return "Липсват защитените данни за вход от Telegram. Моля, стартирайте приложението от бутона в Telegram.";
    case "init_data_validation_failed":
      return "Защитената проверка на Telegram данните се провали. Проверете настройката на Telegram bot token-а за Mini App.";
    default:
      return import.meta.env.DEV && reason
        ? `Не успяхме да Ви впишем автоматично чрез Telegram. ${reason}`
        : "Не успяхме да Ви впишем автоматично чрез Telegram. Опитайте отново след секунди.";
  }
}

const TelegramAuthGate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(() => shouldAttemptTelegramDetection());
  const [attemptedTelegramAuth, setAttemptedTelegramAuth] = useState(() => shouldAttemptTelegramDetection());
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugState, setDebugState] = useState<TelegramAuthDebugState | null>(null);

  const runTelegramAuth = useCallback(
    async (force = false) => {
      const shouldAttempt = shouldAttemptTelegramDetection();
      setAttemptedTelegramAuth(shouldAttempt);

      if (!shouldAttempt) {
        setChecking(false);
        setRetrying(false);
        setError(null);
        return;
      }

      if (force) setRetrying(true);
      else setChecking(true);

      const result = await authenticateViaTelegram({ force });
      setDebugState(result.debug);

      if (result.success) {
        setChecking(false);
        setRetrying(false);
        setError(null);

        if (location.pathname === "/" || location.pathname === "/auth") {
          navigate("/dashboard", { replace: true });
        }
        return;
      }

      setChecking(false);
      setRetrying(false);
      setError(getTelegramFallbackMessage(result.reason));
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    void runTelegramAuth();
  }, [runTelegramAuth]);

  if (attemptedTelegramAuth && checking) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center px-5">
          <div className="hero-luxury rounded-2xl p-8 w-full max-w-md text-center space-y-4 slide-up">
            <div className="icon-circle w-14 h-14 mx-auto">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-display-sm font-bold">Свързваме Ви с Telegram</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Проверяваме Вашата Mini App сесия и зареждаме профила Ви автоматично.
              </p>
            </div>
          </div>
        </div>
        <TelegramDebugPanel debug={debugState} isChecking />
      </>
    );
  }

  if (!attemptedTelegramAuth || (attemptedTelegramAuth && error)) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center px-5">
          <div className="hero-luxury rounded-2xl p-8 w-full max-w-md text-center space-y-5 slide-up">
            <div className="icon-circle w-14 h-14 mx-auto">
              <Send className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-display-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                AI стилист
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Моля, отворете приложението през Telegram бота.
              </p>
            </div>
            <Button
              className="w-full rounded-full h-11 gap-2"
              onClick={() => window.open(TELEGRAM_BOT_URL, "_blank")}
            >
              <Send className="w-4 h-4" />
              Отвори в Telegram
            </Button>
            {attemptedTelegramAuth && error && (
              <p className="text-xs text-muted-foreground">{error}</p>
            )}
          </div>
        </div>
        <TelegramDebugPanel debug={debugState} isChecking={false} />
      </>
    );
  }

  return (
    <>
      <AppRoutes />
      <TelegramDebugPanel debug={debugState} isChecking={false} />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TelegramAuthGate />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
