import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Eye, MessageCircle, Star, Heart, ArrowRight, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import WeeklyStylist from "@/components/WeeklyStylist";
import TelegramHooks from "@/components/TelegramHooks";

interface GeneratedImage {
  id: string;
  image_url: string;
  image_type: string;
  style_name: string | null;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [recentImages, setRecentImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else {
        initializeAndFetch();
        fetchRecentImages();
      }
    });
  }, [navigate]);

  const initializeAndFetch = async () => {
    try {
      // Ensure profile exists with bonus tokens for new users
      await supabase.functions.invoke("initialize-user");
    } catch {}
    fetchTokens();
  };

  const fetchTokens = async () => {
    try {
      const { data } = await supabase.functions.invoke("check-tokens");
      setTokenBalance(data?.tokenBalance ?? 0);
    } catch {}
  };

  const fetchRecentImages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("generated_images")
      .select("id, image_url, image_type, style_name, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    setRecentImages(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader tokenBalance={tokenBalance} />

      <main className="max-w-2xl mx-auto px-4 py-6 md:px-6 space-y-6">
        {/* Hero CTA */}
        <section className="hero-luxury rounded-2xl p-6 md:p-8 text-center space-y-4 slide-up">
          <div className="icon-circle w-14 h-14 mx-auto">
            <Sparkles className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div className="space-y-2">
            <h2
              className="text-display-sm font-bold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Добре дошли
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Получете персонална визия за облекло и прическа с помощта на AI
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-full px-8 py-5 gap-2 text-sm shadow-luxury active:scale-[0.97] transition-transform"
            onClick={() => navigate("/studio")}
          >
            Получете персонална визия <ArrowRight className="w-4 h-4" />
          </Button>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-3">
          {[
            { label: "Анализ на стила", icon: Eye, path: "/studio" },
            { label: "AI стилист", icon: MessageCircle, path: "/ai-stylist" },
            { label: "Моите визии", icon: Heart, path: "/cabinet" },
            { label: "Моят профил", icon: Star, path: "/profile" },
          ].map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              className="premium-card p-4 flex flex-col items-center gap-2.5 touch-target"
              onClick={() => navigate(path)}
            >
              <div className="icon-circle w-11 h-11">
                <Icon className="w-4 h-4 text-foreground/70" />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </section>

        {/* Style Profile Summary */}
        <section className="premium-card-featured p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Вашият стилов профил</h3>
              <p className="text-meta leading-relaxed">
                Попълнете за по-точни AI препоръки
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full h-8 px-4 active:scale-[0.97] transition-transform"
              style={{ borderColor: "hsl(var(--accent-taupe) / 0.5)" }}
              onClick={() => navigate("/profile")}
            >
              Виж <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </section>

        {/* Recent Looks */}
        <section className="premium-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Последни визии</h3>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full h-8 px-4 active:scale-[0.97] transition-transform"
              style={{ borderColor: "hsl(var(--accent-taupe) / 0.5)" }}
              onClick={() => navigate("/cabinet")}
            >
              Всички <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentImages.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="icon-circle w-14 h-14 mx-auto">
                <Heart className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-meta">Все още нямате визии</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs active:scale-[0.97] transition-transform"
                style={{ borderColor: "hsl(var(--accent-taupe) / 0.5)" }}
                onClick={() => navigate("/studio")}
              >
                Създайте първата визия
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {recentImages.slice(0, 6).map((img) => (
                <div
                  key={img.id}
                  className="aspect-square rounded-xl overflow-hidden shadow-premium transition-shadow duration-300 hover:shadow-premium-lg"
                  style={{ border: "1px solid hsl(var(--border) / 0.3)" }}
                >
                  <img
                    src={img.image_url}
                    alt={img.style_name || "Визия"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Two-column bottom */}
        <div className="grid md:grid-cols-2 gap-4">
          <WeeklyStylist hasTokens={tokenBalance > 0} onUnlock={() => navigate("/studio")} />
          <TelegramHooks variant="card" />
        </div>

        {/* Occasion Quick Access */}
        <section className="premium-card-featured p-5 space-y-3">
          <h3 className="font-semibold text-sm">Визия за повод</h3>
          <div className="flex flex-wrap gap-2">
            {["Работа", "Среща", "Интервю", "Уикенд", "Официално", "Лято", "Зима"].map(
              (occ) => (
                <button
                  key={occ}
                  className="chip-luxury-default"
                  onClick={() => navigate("/ai-stylist")}
                >
                  {occ}
                </button>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
