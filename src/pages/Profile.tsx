import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, User } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface StyleProfile {
  gender: string;
  primary_style: string;
  secondary_style: string;
  suitable_colors: string;
  avoid_colors: string;
  suitable_cuts: string;
  recommended_hairstyles: string;
  formality_level: string;
  preferred_occasions: string;
  budget_range: string;
  maintenance_level: string;
}

const EMPTY_PROFILE: StyleProfile = {
  gender: "",
  primary_style: "",
  secondary_style: "",
  suitable_colors: "",
  avoid_colors: "",
  suitable_cuts: "",
  recommended_hairstyles: "",
  formality_level: "",
  preferred_occasions: "",
  budget_range: "",
  maintenance_level: "",
};

const GENDER_OPTIONS = [
  { value: "male", label: "Мъж" },
  { value: "female", label: "Жена" },
];

const FIELD_GROUPS: { title: string; fields: { key: keyof StyleProfile; label: string; placeholder: string }[] }[] = [
  {
    title: "Стил",
    fields: [
      { key: "primary_style", label: "Основен стил", placeholder: "напр. Класически, Кежуъл..." },
      { key: "secondary_style", label: "Втори стил", placeholder: "напр. Бохо, Спортен..." },
      { key: "formality_level", label: "Ниво на формалност", placeholder: "напр. Полуформален, Кежуъл..." },
    ],
  },

  {
    title: "Цветове и кройки",
    fields: [
      { key: "suitable_colors", label: "Подходящи цветове", placeholder: "напр. Бежово, Тъмно синьо..." },
      { key: "avoid_colors", label: "Какво да избягвате", placeholder: "напр. Неон, Яркочервено..." },
      { key: "suitable_cuts", label: "Кройки за Вас", placeholder: "напр. Прави, A-линия..." },
    ],
  },
  {
    title: "Прически и поддръжка",
    fields: [
      { key: "recommended_hairstyles", label: "Прически за Вашия тип", placeholder: "напр. Средна дължина, Къса..." },
      { key: "maintenance_level", label: "Предпочитано ниво на поддръжка", placeholder: "напр. Ниско, Средно..." },
    ],
  },
  {
    title: "Предпочитания",
    fields: [
      { key: "preferred_occasions", label: "Поводи", placeholder: "напр. Работа, Среща, Уикенд..." },
      { key: "budget_range", label: "Бюджет", placeholder: "напр. Среден, Премиум..." },
    ],
  },
];

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StyleProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else {
        fetchProfile(session.user.id);
        fetchTokens();
      }
    });
  }, [navigate]);

  const fetchTokens = async () => {
    try {
      const { data } = await supabase.functions.invoke("check-tokens");
      setTokenBalance(data?.tokenBalance ?? 0);
    } catch {}
  };

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("style_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setProfile({
        gender: (data as any).gender || "unspecified",
        primary_style: data.primary_style || "",
        secondary_style: data.secondary_style || "",
        suitable_colors: data.suitable_colors || "",
        avoid_colors: data.avoid_colors || "",
        suitable_cuts: data.suitable_cuts || "",
        recommended_hairstyles: data.recommended_hairstyles || "",
        formality_level: data.formality_level || "",
        preferred_occasions: data.preferred_occasions || "",
        budget_range: data.budget_range || "",
        maintenance_level: data.maintenance_level || "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Не сте влезли");

      const { error } = await supabase
        .from("style_profiles")
        .upsert({
          user_id: session.user.id,
          ...profile,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Профилът е запазен");
    } catch (e: any) {
      toast.error(e.message || "Грешка при запазване");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof StyleProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader tokenBalance={tokenBalance} />

      <main className="max-w-xl mx-auto px-4 py-6 md:px-6">
        <div className="flex items-center gap-3 mb-8 slide-up">
          <div className="icon-circle w-14 h-14">
            <User className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div>
            <h2 className="text-display-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Моят стилов профил
            </h2>
            <p className="text-meta mt-0.5">
              Попълнете за по-точни AI препоръки
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Gender selector */}
            <div className="hero-luxury rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Пол</h3>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleChange("gender", opt.value)}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      profile.gender === opt.value
                        ? "bg-primary text-primary-foreground shadow-luxury"
                        : "hover:opacity-80"
                    }`}
                    style={profile.gender !== opt.value ? {
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border) / 0.5)",
                      color: "hsl(var(--foreground))",
                    } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {FIELD_GROUPS.map((group, gi) => (
              <div key={group.title} className="premium-card p-5 space-y-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-3">
                  {group.fields.map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground/80">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={profile[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 transition-shadow placeholder:text-muted-foreground/50"
                        style={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border) / 0.5)",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              className="w-full rounded-full py-5 shadow-luxury"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Запазваме...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Запази профила</>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;
