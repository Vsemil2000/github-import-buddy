import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Send, Sparkles } from "lucide-react";
import QuickPromptChips from "@/components/QuickPromptChips";
import OccasionSelector from "@/components/OccasionSelector";
import AppHeader from "@/components/AppHeader";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AIStylist = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [selectedOccasion, setSelectedOccasion] = useState<string>();
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [genderLoaded, setGenderLoaded] = useState(false);
  const [awaitingGender, setAwaitingGender] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else {
        fetchTokens();
        fetchGender(session.user.id);
      }
    });
  }, [navigate]);

  const fetchGender = async (userId: string) => {
    const { data } = await supabase
      .from("style_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const g = (data as any)?.gender;
    setUserGender(g && g !== "unspecified" && (g === "male" || g === "female") ? g : null);
    setGenderLoaded(true);
  };

  const saveGender = async (gender: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("style_profiles").upsert({
      user_id: session.user.id,
      gender,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id" });
    setUserGender(gender);
    setAwaitingGender(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchTokens = async () => {
    try {
      const { data } = await supabase.functions.invoke("check-tokens");
      setTokenBalance(data?.tokenBalance ?? 0);
    } catch {}
  };

  const spendToken = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("spend-token");
      if (error || data?.error) {
        toast.error("Недостатъчно токени");
        return false;
      }
      setTokenBalance(data.tokenBalance ?? 0);
      return true;
    } catch {
      toast.error("Грешка при проверка на токени");
      return false;
    }
  };

  const handleSend = async (prompt?: string) => {
    const text = prompt || input.trim();
    if (!text || loading) return;

    // Check gender before first message
    if (!userGender && genderLoaded && messages.length === 0) {
      setPendingPrompt(text);
      setAwaitingGender(true);
      return;
    }

    setPendingPrompt(prompt || null);

    const canProceed = await spendToken();
    if (!canProceed) { setPendingPrompt(null); return; }

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-stylist", {
        body: {
          messages: [...messages, userMsg],
          occasion: selectedOccasion,
          gender: userGender || "unspecified",
        },
      });
      if (error) throw error;

      const assistantMsg: Message = {
        role: "assistant",
        content: data?.reply || "Нямам отговор в момента. Моля, опитайте отново.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      toast.error(e.message || "Грешка при AI стилиста");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setPendingPrompt(null);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (loading) return;
    handleSend(prompt);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader tokenBalance={tokenBalance} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
        {/* Gender prompt overlay */}
        {awaitingGender && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="premium-card p-6 max-w-sm mx-4 space-y-4 text-center">
              <Sparkles className="w-8 h-8 mx-auto" style={{ color: "hsl(var(--primary))" }} />
              <p className="text-sm leading-relaxed text-foreground">
                За да дам точни препоръки за облекло и прическа, моля изберете пол:
              </p>
              <div className="flex gap-2">
                {[
                  { value: "male", label: "Мъж" },
                  { value: "female", label: "Жена" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant="default"
                    className="flex-1 rounded-full"
                    onClick={async () => {
                      await saveGender(opt.value);
                      if (pendingPrompt) {
                        handleSend(pendingPrompt);
                      }
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          /* Welcome state */
          <div className="flex-1 flex flex-col justify-center space-y-8 slide-up">
            <div className="text-center space-y-3">
              <div className="icon-circle w-16 h-16 mx-auto">
                <Sparkles className="w-7 h-7" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <h2 className="text-display-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Попитайте своя AI стилист
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Получете персонални препоръки за облекло и прически според Вашата визия, повод и предпочитания.
              </p>
            </div>

            <div className="space-y-6">
              <OccasionSelector onSelect={setSelectedOccasion} selected={selectedOccasion} />
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Бързи въпроси</h4>
                <QuickPromptChips onSelect={handleQuickPrompt} disabled={loading} pendingPrompt={pendingPrompt} />
              </div>
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md shadow-luxury"
                      : "rounded-bl-md"
                  }`}
                  style={msg.role === "assistant" ? {
                    background: "hsl(var(--surface-featured))",
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--accent-taupe) / 0.2)",
                    boxShadow: "0 2px 8px hsl(18 18% 14% / 0.04)",
                  } : undefined}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3"
                  style={{
                    background: "hsl(var(--surface-featured))",
                    border: "1px solid hsl(var(--accent-taupe) / 0.2)",
                  }}
                >
                  <p className="text-xs text-muted-foreground mb-1.5">AI стилистът подготвя персонални идеи за Вас...</p>
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <div
          className="sticky bottom-0 pt-3 pb-2"
          style={{
            background: "linear-gradient(0deg, hsl(var(--background)) 80%, hsl(var(--background) / 0) 100%)",
            borderTop: "1px solid hsl(var(--border) / 0.3)",
          }}
        >
          {messages.length > 0 && (
            <div className="mb-3 overflow-x-auto pb-1">
              <QuickPromptChips onSelect={handleQuickPrompt} disabled={loading} pendingPrompt={pendingPrompt} />
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Попитайте AI стилиста..."
              className="flex-1 px-4 py-3 rounded-full text-sm focus:outline-none focus:ring-2 transition-shadow"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border) / 0.5)",
                color: "hsl(var(--foreground))",
              }}
              disabled={loading}
            />
            <Button
              size="icon"
              className="shrink-0 h-11 w-11 rounded-full shadow-luxury"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center tabular-nums">
            1 въпрос = 1 токен · Баланс: {tokenBalance} токена
          </p>
        </div>
      </main>
    </div>
  );
};

export default AIStylist;
