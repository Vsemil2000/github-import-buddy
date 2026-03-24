import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Loader2, Download, LayoutGrid, Coins, ShoppingCart, Star, Shirt, Scissors } from "lucide-react";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HairstyleSection from "@/components/HairstyleSection";
import NextStepPanel from "@/components/NextStepPanel";
import AppHeader from "@/components/AppHeader";
interface Style {
  name: string;
  description: string;
  items: string[];
  colors: string[];
}

interface StyleCardState {
  fittingUrl?: string;
  fittingLoading: boolean;
  flatlayUrl?: string;
  flatlayLoading: boolean;
}

const PACKAGES = [
  { id: "1_star", tokens: 1, stars: 1, label: "1 токен" },
  { id: "5_stars", tokens: 5, stars: 5, label: "5 токена" },
  { id: "10_stars", tokens: 10, stars: 10, label: "10 токена" },
  { id: "25_stars", tokens: 25, stars: 25, label: "25 токена" },
  { id: "50_stars", tokens: 50, stars: 50, label: "50 токена" },
];

const Studio = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [activeTab, setActiveTab] = useState<"clothing" | "hairstyle">("clothing");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const { uploading, uploadError, handleFileUpload, debugLog } = useImageUpload();
  const [analyzing, setAnalyzing] = useState(false);
  const [styles, setStyles] = useState<Style[] | null>(null);
  const [cardStates, setCardStates] = useState<StyleCardState[]>([]);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [showShop, setShowShop] = useState(false);
  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else fetchTokens();
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchTokens = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-tokens");
      if (error) throw error;
      setTokenBalance(data.tokenBalance ?? 0);
    } catch (e) {
      console.error("Failed to fetch tokens:", e);
    }
  };

  const spendToken = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("spend-token");
      
      if (error) {
        try {
          const errorBody = typeof error === 'object' && 'context' in error 
            ? await (error as any).context?.json?.() 
            : null;
          if (errorBody?.needTokens) {
            toast.error("Недостатъчно токени. Купете токени, за да продължите.");
            setShowShop(true);
            return false;
          }
        } catch {
          // parsing failed
        }
        toast.error("Недостатъчно токени. Купете токени, за да продължите.");
        setShowShop(true);
        return false;
      }

      if (data?.error) {
        if (data.needTokens) {
          toast.error("Недостатъчно токени. Купете токени, за да продължите.");
          setShowShop(true);
          return false;
        }
        throw new Error(data.error);
      }
      setTokenBalance(data.tokenBalance ?? 0);
      return true;
    } catch (e: any) {
      toast.error(e.message || "Грешка при проверка на токени");
      return false;
    }
  };

  const handleBuyPackage = async (packageId: string) => {
    setBuyingPackage(packageId);
    try {
      const pkg = PACKAGES.find(p => p.id === packageId);
      if (!pkg) throw new Error("Невалиден пакет");

      const { data, error } = await supabase.functions.invoke("create-stars-payment", {
        body: { tokens: pkg.tokens, stars: pkg.stars },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (data.invoiceLink) {
        window.open(data.invoiceLink, "_blank");
        toast.info("Отворете линка в Telegram, за да платите с ⭐ Stars. След плащане токените ще бъдат добавени автоматично.");
        // Start polling for payment confirmation
        pollForPayment();
      }
    } catch (e: any) {
      toast.error(e.message || "Грешка при създаване на плащане");
    } finally {
      setBuyingPackage(null);
    }
  };

  const pollForPayment = () => {
    // Poll every 5 seconds for 2 minutes to check if tokens were credited
    let attempts = 0;
    const maxAttempts = 24;
    const interval = setInterval(async () => {
      attempts++;
      await fetchTokens();
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 5000);
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Файлът е твърде голям (макс. 10 МБ)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result);
      setStyles(null);
      setCardStates([]);
    };
    reader.readAsDataURL(file);
  };

  const analyzeStyle = async () => {
    if (!photoBase64) return;

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-style", {
        body: { imageBase64: photoBase64, gender },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setStyles(data.styles);
      setCardStates(data.styles.map(() => ({
        fittingLoading: false,
        flatlayLoading: false,
      })));
    } catch (e: any) {
      toast.error(e.message || "Грешка при анализ");
    } finally {
      setAnalyzing(false);
    }
  };

  const generateFitting = async (index: number) => {
    if (!photoBase64 || !styles) return;
    const canProceed = await spendToken();
    if (!canProceed) return;

    const style = styles[index];
    setCardStates(prev => prev.map((s, i) => i === index ? { ...s, fittingLoading: true } : s));
    try {
      const { data, error } = await supabase.functions.invoke("generate-fitting", {
        body: {
          imageBase64: photoBase64,
          styleDescription: style.description,
          styleName: style.name,
          gender,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCardStates(prev =>
        prev.map((s, i) => i === index ? { ...s, fittingUrl: data.imageUrl, fittingLoading: false } : s)
      );
      toast.success("Снимката е генерирана!");
    } catch (e: any) {
      toast.error(e.message || "Грешка при генериране");
      setCardStates(prev => prev.map((s, i) => i === index ? { ...s, fittingLoading: false } : s));
    }
  };

  const generateFlatlay = async (index: number) => {
    if (!styles || !cardStates[index]?.fittingUrl) return;
    const canProceed = await spendToken();
    if (!canProceed) return;

    const style = styles[index];
    setCardStates(prev => prev.map((s, i) => i === index ? { ...s, flatlayLoading: true } : s));
    try {
      const { data, error } = await supabase.functions.invoke("generate-flatlay", {
        body: {
          fittingImageUrl: cardStates[index].fittingUrl,
          styleDescription: style.description,
          styleName: style.name,
          items: style.items,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCardStates(prev =>
        prev.map((s, i) => i === index ? { ...s, flatlayUrl: data.imageUrl, flatlayLoading: false } : s)
      );
      toast.success("Разгъвката е генерирана!");
    } catch (e: any) {
      toast.error(e.message || "Грешка при генериране");
      setCardStates(prev => prev.map((s, i) => i === index ? { ...s, flatlayLoading: false } : s));
    }
  };

  const downloadImage = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Грешка при изтегляне");
    }
  };

  const handleNextAction = (action: string) => {
    switch (action) {
      case "ask_stylist":
        navigate("/ai-stylist");
        break;
      case "save_profile":
        navigate("/profile");
        break;
      case "total_look":
      case "combine_hairstyle":
        setActiveTab("hairstyle");
        break;
      case "combine_outfit":
        setActiveTab("clothing");
        break;
      default:
        toast.info("Тази функция ще бъде налична скоро!");
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader tokenBalance={tokenBalance} onShowShop={() => setShowShop(true)} />

      <main className="max-w-2xl mx-auto px-4 py-6 md:px-6 space-y-8">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("clothing")}
            className={`flex items-center gap-1.5 ${activeTab === "clothing" ? "chip-luxury-active" : "chip-luxury-default"}`}
          >
            <Shirt className="w-3.5 h-3.5" />
            Стил на обличане
          </button>
          <button
            onClick={() => setActiveTab("hairstyle")}
            className={`flex items-center gap-1.5 ${activeTab === "hairstyle" ? "chip-luxury-active" : "chip-luxury-default"}`}
          >
            <Scissors className="w-3.5 h-3.5" />
            Стил на прическа
          </button>
        </div>

        {activeTab === "clothing" ? (
        <>
        <section className="space-y-5 slide-up">
          <h2 className="text-display-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Анализ на стила
          </h2>

          <div className="flex gap-2">
            <button onClick={() => setGender("female")} className={gender === "female" ? "chip-luxury-active" : "chip-luxury-default"}>
              Женски
            </button>
            <button onClick={() => setGender("male")} className={gender === "male" ? "chip-luxury-active" : "chip-luxury-default"}>
              Мъжки
            </button>
          </div>

          <div
            className="hero-luxury rounded-2xl p-8 text-center cursor-pointer hover:shadow-luxury-lg transition-shadow duration-300 active:scale-[0.99] block relative overflow-hidden"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Вашата снимка"
                className="max-h-80 mx-auto rounded-xl object-contain"
              />
            ) : (
              <div className="space-y-3 py-4">
                <div className="icon-circle w-14 h-14 mx-auto">
                  <Upload className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
                </div>
                <p className="text-sm text-muted-foreground">Натиснете, за да качите снимка в цял ръст</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              id="studio-photo-upload"
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileChange}
            />
          </div>

          <Button
            size="lg"
            className="w-full rounded-full py-5 shadow-luxury"
            onClick={analyzeStyle}
            disabled={!photoBase64 || analyzing}
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Анализираме...</>
            ) : (
              <>
                Анализирай стила
                <span className="ml-2 text-xs opacity-60">(безплатно)</span>
              </>
            )}
          </Button>
        </section>

        {styles && (
          <section className="space-y-5">
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Вашите стилове
            </h2>
            <div className="grid gap-4">
              {styles.map((style, idx) => (
                <div key={idx} className="premium-card p-5 space-y-4">
                  <h3 className="text-lg font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {style.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{style.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {style.items.map((item, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "hsl(var(--surface-featured))" }}>
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-1.5">
                    {style.colors.map((color, i) => (
                      <span key={i} className="px-3 py-1 border border-border/50 rounded-full text-xs">
                        {color}
                      </span>
                    ))}
                  </div>

                  {!cardStates[idx]?.fittingUrl ? (
                    <Button
                      onClick={() => generateFitting(idx)}
                      disabled={cardStates[idx]?.fittingLoading}
                      className="w-full rounded-full shadow-premium"
                    >
                      {cardStates[idx]?.fittingLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерираме...</>
                      ) : (
                        "Генерирай снимка с тези дрехи"
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <img
                        src={cardStates[idx].fittingUrl}
                        alt={`Пробна: ${style.name}`}
                        className="w-full rounded-xl"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-full text-xs"
                          onClick={() => downloadImage(cardStates[idx].fittingUrl!, `ai-stylist-${style.name}`)}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> Изтегли
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 rounded-full text-xs"
                          onClick={() => generateFlatlay(idx)}
                          disabled={cardStates[idx]?.flatlayLoading}
                        >
                          {cardStates[idx]?.flatlayLoading ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Генерираме...</>
                          ) : (
                            <><LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Генерирай разгъвка</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {cardStates[idx]?.flatlayUrl && (
                    <div className="space-y-3">
                      <img
                        src={cardStates[idx].flatlayUrl}
                        alt={`Разгъвка: ${style.name}`}
                        className="w-full rounded-xl"
                      />
                      <Button
                        variant="outline"
                        className="w-full rounded-full text-xs"
                        onClick={() => downloadImage(cardStates[idx].flatlayUrl!, `flatlay-${style.name}`)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Изтегли разгъвка
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {styles && (
          <NextStepPanel context="clothing" onAction={handleNextAction} />
        )}
        </>
        ) : (
          <HairstyleSection
            sharedPhotoPreview={photoPreview}
            sharedPhotoBase64={photoBase64}
            spendToken={spendToken}
            onSwitchTab={setActiveTab}
          />
        )}
      </main>

      <Dialog open={showShop} onOpenChange={setShowShop}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              <ShoppingCart className="w-4 h-4" />
              Купете токени
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            1 ⭐ Telegram Star = 1 токен = 1 генерация
          </p>
          <div className="space-y-2 mt-3">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleBuyPackage(pkg.id)}
                disabled={buyingPackage === pkg.id}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border/40 hover:shadow-sm transition-all duration-200 disabled:opacity-50 text-left active:scale-[0.98] touch-target" style={{ background: "hsl(var(--surface-warm))" }}
              >
                <div>
                  <p className="font-semibold text-sm">{pkg.label}</p>
                  <p className="text-[10px] text-muted-foreground">1 ⭐ / токен</p>
                </div>
                <div className="text-right flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <p className="font-bold text-base tabular-nums">{pkg.stars}</p>
                </div>
                {buyingPackage === pkg.id && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 bg-secondary/40 rounded-xl">
            <p className="text-xs text-center tabular-nums">
              Вашият баланс: <span className="font-semibold">{tokenBalance} токена</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Studio;
