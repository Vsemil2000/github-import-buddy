import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { AUTH_REDIRECT_URL } from "@/config/app";
import { isTelegramMiniApp } from "@/lib/telegram";

interface LegacyRecoveryResponse {
  access_token?: string;
  refresh_token?: string;
  recovered?: boolean;
  error?: string;
}

async function recoverLegacyAccount(email: string, password: string) {
  const { data, error } = await supabase.functions.invoke<LegacyRecoveryResponse>(
    "recover-legacy-login",
    {
      body: { email, password },
    }
  );

  if (error) {
    throw new Error(error.message || "Неуспешно възстановяване на стар профил");
  }

  if (!data?.recovered || !data.access_token || !data.refresh_token) {
    throw new Error(data?.error || "Старият профил не беше намерен");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  if (sessionError) {
    throw new Error(sessionError.message || "Неуспешно създаване на сесия");
  }
}

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In Telegram, user is already authenticated — redirect immediately
    if (isTelegramMiniApp()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigate("/dashboard", { replace: true });
      });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  function toBulgarianError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid credentials"))
      return "Грешен имейл или парола.";
    if (lower.includes("user not found"))
      return "Потребителят не е намерен.";
    if (lower.includes("email not confirmed"))
      return "Имейлът не е потвърден. Проверете пощата си.";
    if (lower.includes("too many requests") || lower.includes("rate limit"))
      return "Твърде много опити. Опитайте отново след малко.";
    if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to send"))
      return "Мрежова грешка. Проверете интернет връзката си.";
    return msg;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const normalizedMessage = error.message?.toLowerCase?.() ?? "";
          const shouldTryLegacyRecovery =
            normalizedMessage.includes("invalid login credentials") ||
            normalizedMessage.includes("invalid credentials");

          if (shouldTryLegacyRecovery) {
            try {
              await recoverLegacyAccount(email, password);
              toast.success("Входът със старите данни е възстановен");
              return;
            } catch {
              // Legacy recovery failed — show the original auth error
            }
          }

          throw error;
        }
        toast.success("Добре дошли!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) throw error;
        toast.success("Проверете пощата си за потвърждение на регистрацията");
      }
    } catch (error: any) {
      toast.error(toBulgarianError(error.message ?? "Възникна грешка."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 py-4 md:px-10">
        <h1
          className="text-xl font-semibold tracking-tight cursor-pointer"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "hsl(var(--primary))" }}
          onClick={() => navigate("/")}
        >
          AI стилист
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm slide-up">
          <div className="hero-luxury rounded-2xl p-6 md:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="icon-circle w-14 h-14 mx-auto">
                <Sparkles className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <h2 className="text-display-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {isLogin ? "Вход" : "Регистрация"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {isLogin ? "Влезте в акаунта си" : "Създайте нов акаунт"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">Имейл</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="rounded-xl h-11"
                  style={{ borderColor: "hsl(var(--border) / 0.5)", background: "hsl(var(--background))" }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium">Парола</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="rounded-xl h-11"
                  style={{ borderColor: "hsl(var(--border) / 0.5)", background: "hsl(var(--background))" }}
                />
              </div>
              <Button type="submit" className="w-full rounded-full h-11 shadow-luxury" disabled={loading}>
                {loading ? "Зареждане..." : isLogin ? "Вход" : "Регистрация"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {isLogin ? "Нямате акаунт?" : "Вече имате акаунт?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
              >
                {isLogin ? "Регистрация" : "Вход"}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
