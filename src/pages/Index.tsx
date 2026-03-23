import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Camera, Sparkles, Shirt, Eye, Briefcase, Heart, Sun, Scissors, CalendarDays, MessageCircle } from "lucide-react";
import { isTelegramMiniApp } from "@/lib/telegram";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  // In Telegram Mini App, skip landing page — go straight to dashboard
  useEffect(() => {
    if (isTelegramMiniApp()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigate("/dashboard", { replace: true });
      });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-4 md:px-10">
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "hsl(var(--primary))" }}
        >
          AI стилист
        </h1>
        {!isTelegramMiniApp() && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-5 h-9"
            style={{ borderColor: "hsl(var(--accent-taupe) / 0.6)" }}
            onClick={() => navigate("/auth")}
          >
            Вход
          </Button>
        )}
      </header>

      <main className="px-5 md:px-10">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center py-16 md:py-24 text-center slide-up">
          <div className="max-w-xl space-y-5">
            <p className="text-xs font-medium tracking-[0.15em] uppercase" style={{ color: "hsl(var(--primary) / 0.7)" }}>
              Персонален AI асистент
            </p>
            <h2
              className="text-display-sm md:text-display font-bold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", textWrap: "balance" as any }}
            >
              Вашият личен AI асистент за облекло и прически
            </h2>
            <p
              className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed"
              style={{ textWrap: "pretty" as any }}
            >
              Качете снимка — получете персонални препоръки за стил на обличане и прическа и пробвайте визии виртуално
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
              <Button
                size="lg"
                className="text-sm px-8 py-6 gap-2 rounded-full shadow-luxury"
                onClick={() => navigate("/auth")}
              >
                Започнете безплатно <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-sm px-8 py-6 gap-2 rounded-full"
                style={{ borderColor: "hsl(var(--accent-taupe) / 0.6)" }}
                onClick={() => navigate("/auth")}
              >
                <MessageCircle className="w-4 h-4" />
                Попитайте AI стилиста
              </Button>
            </div>
          </div>
        </section>

        {/* 4 Steps */}
        <section className="max-w-3xl mx-auto py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Camera, title: "Качете снимка", desc: "Направете снимка в цял ръст" },
              { icon: Sparkles, title: "AI анализ", desc: "Получете стилови препоръки" },
              { icon: Eye, title: "Персонални визии", desc: "Индивидуални стилови идеи" },
              { icon: Shirt, title: "Виртуална проба", desc: "Пробвайте визии виртуално" },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="premium-card flex flex-col items-center gap-3 p-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--accent-rose) / 0.5), hsl(var(--accent-gold) / 0.25))",
                    boxShadow: "0 2px 8px hsl(345 28% 50% / 0.08)",
                  }}
                >
                  <Icon className="w-5 h-5 text-foreground/70" />
                </div>
                <h3 className="text-sm font-semibold text-center leading-tight">{title}</h3>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recurring value */}
        <section className="max-w-3xl mx-auto py-12">
          <h3
            className="text-display-sm font-bold text-center mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Защо да се връщате
          </h3>
          <p className="text-muted-foreground text-center mb-8 text-sm">
            Нови визии за всеки момент от живота Ви
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { icon: Briefcase, label: "Визии за работа" },
              { icon: Heart, label: "Визии за среща" },
              { icon: Sun, label: "Визии за сезон" },
              { icon: Scissors, label: "Прически за Вас" },
              { icon: CalendarDays, label: "Седмични идеи" },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="premium-card-featured flex flex-col items-center gap-2.5 p-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "hsl(var(--accent-rose) / 0.4)" }}
                >
                  <Icon className="w-4.5 h-4.5 text-foreground/60" />
                </div>
                <span className="text-xs font-medium text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-md mx-auto py-16 text-center">
          <div className="hero-luxury rounded-2xl p-8 md:p-10 space-y-4">
            <h3
              className="text-display-sm font-bold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Готови ли сте?
            </h3>
            <p className="text-muted-foreground text-sm">
              Открийте своя персонален стил с помощта на AI
            </p>
            <Button
              size="lg"
              className="px-8 py-6 gap-2 rounded-full shadow-luxury"
              onClick={() => navigate("/auth")}
            >
              Започнете безплатно <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer
        className="px-5 py-6 text-center text-xs text-muted-foreground"
        style={{ borderTop: "1px solid hsl(var(--border) / 0.4)" }}
      >
        © {new Date().getFullYear()} AI стилист. Всички права запазени.
      </footer>
    </div>
  );
};

export default Index;
