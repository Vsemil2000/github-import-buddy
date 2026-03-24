import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Loader2, Download, Scissors, Sparkles } from "lucide-react";
import NextStepPanel from "@/components/NextStepPanel";
import { useImageUpload } from "@/hooks/use-image-upload";

interface Hairstyle {
  name: string;
  category: string;
  description: string;
  whySuitable: string;
  maintenanceTips: string;
}

interface HairstyleCardState {
  imageUrl?: string;
  imageLoading: boolean;
}

interface HairstyleSectionProps {
  sharedPhotoPreview: string | null;
  sharedPhotoBase64: string | null;
  spendToken: () => Promise<boolean>;
  onSwitchTab?: (tab: "clothing" | "hairstyle") => void;
}

const HairstyleSection = ({
  sharedPhotoPreview,
  sharedPhotoBase64,
  spendToken,
  onSwitchTab,
}: HairstyleSectionProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [hairstyles, setHairstyles] = useState<Hairstyle[] | null>(null);
  const [cardStates, setCardStates] = useState<HairstyleCardState[]>([]);
  const [useSharedPhoto, setUseSharedPhoto] = useState(false);
  const { uploading, uploadError, handleFileUpload, debugLog } = useImageUpload();

  const activePreview = useSharedPhoto ? sharedPhotoPreview : photoPreview;
  const activeBase64 = useSharedPhoto ? sharedPhotoBase64 : photoBase64;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement> | Event) => {
    const input = (e.target as HTMLInputElement);
    const file = input?.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    const result = await handleFileUpload(file);
    if (result) {
      setPhotoPreview(result.preview);
      setPhotoBase64(result.base64);
      setUseSharedPhoto(false);
      setHairstyles(null);
      setCardStates([]);
    }
  };

  const triggerFileInput = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handler = (e: Event) => handleFileChange(e);
    input.addEventListener("input", handler);
    return () => input.removeEventListener("input", handler);
  }, []);

  const handleUseSharedPhoto = () => {
    setUseSharedPhoto(true);
    setPhotoPreview(null);
    setPhotoBase64(null);
    setHairstyles(null);
    setCardStates([]);
  };

  const analyzeHairstyle = async () => {
    if (!activeBase64) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-hairstyle", {
        body: { imageBase64: activeBase64, gender },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setHairstyles(data.hairstyles);
      setCardStates(data.hairstyles.map(() => ({ imageLoading: false })));
    } catch (e: any) {
      toast.error(e.message || "Грешка при анализ на прическа");
    } finally {
      setAnalyzing(false);
    }
  };

  const generateHairstyle = async (index: number) => {
    if (!activeBase64 || !hairstyles) return;
    const canProceed = await spendToken();
    if (!canProceed) return;

    const hs = hairstyles[index];
    setCardStates(prev => prev.map((s, i) => i === index ? { ...s, imageLoading: true } : s));
    try {
      const { data, error } = await supabase.functions.invoke("generate-hairstyle", {
        body: {
          imageBase64: activeBase64,
          hairstyleDescription: hs.description,
          hairstyleName: hs.name,
          gender,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCardStates(prev =>
        prev.map((s, i) => i === index ? { ...s, imageUrl: data.imageUrl, imageLoading: false } : s)
      );
      toast.success("Прическата е генерирана!");
    } catch (e: any) {
      toast.error(e.message || "Грешка при генериране на прическа");
      setCardStates(prev => prev.map((s, i) => i === index ? { ...s, imageLoading: false } : s));
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

  return (
    <div className="space-y-8">
      <section className="space-y-5 slide-up">
        <h2 className="text-display-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Анализ на прическа
        </h2>

        <div className="flex gap-2">
          <button onClick={() => setGender("female")} className={gender === "female" ? "chip-luxury-active" : "chip-luxury-default"}>
            Женски
          </button>
          <button onClick={() => setGender("male")} className={gender === "male" ? "chip-luxury-active" : "chip-luxury-default"}>
            Мъжки
          </button>
        </div>

        {sharedPhotoPreview && !useSharedPhoto && (
          <button
            className="w-full premium-card p-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]"
            onClick={handleUseSharedPhoto}
          >
            <Sparkles className="w-4 h-4" />
            Използвай текущата снимка
          </button>
        )}

        <div
          className="premium-card-featured p-8 text-center cursor-pointer hover:shadow-premium-lg transition-shadow duration-300 active:scale-[0.99] block"
          onClick={triggerFileInput}
        >
          {uploading ? (
            <div className="space-y-3 py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Качване на снимката...</p>
            </div>
          ) : activePreview ? (
            <img
              src={activePreview}
              alt="Вашата снимка"
              className="max-h-80 mx-auto rounded-xl object-contain"
            />
          ) : (
            <div className="space-y-3 py-4">
              <div className="icon-circle w-14 h-14 mx-auto">
                <Upload className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <p className="text-sm text-muted-foreground">Натиснете, за да качите портретна снимка</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          id="hairstyle-photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileChange as any}
          disabled={uploading}
        />

        {uploadError && (
          <p className="text-xs text-destructive text-center">{uploadError}</p>
        )}

        {debugLog.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Debug log ({debugLog.length})</summary>
            <pre className="mt-1 p-2 rounded-lg text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap" style={{ background: "hsl(var(--muted))" }}>
              {debugLog.join("\n")}
            </pre>
          </details>
        )}

        {useSharedPhoto && (
          <p className="text-xs text-muted-foreground text-center">
            Използвате снимката от секцията за облекло.{" "}
            <button
              className="underline hover:text-foreground transition-colors"
              onClick={() => {
                setUseSharedPhoto(false);
                setHairstyles(null);
                setCardStates([]);
              }}
            >
              Качете нова
            </button>
          </p>
        )}

        <Button
          size="lg"
          className="w-full rounded-full py-5 shadow-premium"
          onClick={analyzeHairstyle}
          disabled={!activeBase64 || analyzing || uploading}
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Анализираме прическата...</>
          ) : (
            <>
              <Scissors className="w-4 h-4 mr-2" />
              Анализирай прическата
              <span className="ml-2 text-xs opacity-60">(безплатно)</span>
            </>
          )}
        </Button>
      </section>

      {hairstyles && (
        <section className="space-y-5">
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Подходящи прически за Вас
          </h2>
          <div className="grid gap-4">
            {hairstyles.map((hs, idx) => (
              <div key={idx} className="premium-card p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {hs.name}
                  </h3>
                  <span className="inline-block mt-1.5 px-3 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground" style={{ background: "hsl(var(--surface-featured))" }}>
                    {hs.category}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">{hs.description}</p>

                <div className="rounded-xl p-4 space-y-1.5" style={{ background: "hsl(var(--surface-warm))" }}>
                  <p className="text-xs font-medium">Защо ти подхожда:</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{hs.whySuitable}</p>
                </div>

                <div className="rounded-xl p-4 space-y-1.5" style={{ background: "hsl(var(--surface-warm))" }}>
                  <p className="text-xs font-medium">Съвети за поддръжка:</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{hs.maintenanceTips}</p>
                </div>

                {!cardStates[idx]?.imageUrl ? (
                  <Button
                    onClick={() => generateHairstyle(idx)}
                    disabled={cardStates[idx]?.imageLoading}
                    className="w-full rounded-full shadow-premium"
                  >
                    {cardStates[idx]?.imageLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерираме...</>
                    ) : (
                      "Пробвай тази прическа"
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <img
                      src={cardStates[idx].imageUrl}
                      alt={`Прическа: ${hs.name}`}
                      className="w-full rounded-xl"
                    />
                    <Button
                      variant="outline"
                      className="w-full rounded-full text-xs"
                      onClick={() => downloadImage(cardStates[idx].imageUrl!, `hairstyle-${hs.name}`)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Изтегли
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {hairstyles && (
        <NextStepPanel
          context="hairstyle"
          onAction={(action) => {
            switch (action) {
              case "ask_stylist":
                navigate("/ai-stylist");
                break;
              case "save_profile":
                navigate("/profile");
                break;
              case "combine_outfit":
                onSwitchTab?.("clothing");
                break;
              case "total_look":
              case "combine_hairstyle":
                onSwitchTab?.("clothing");
                break;
              default:
                toast.info("Тази функция ще бъде налична скоро!");
                break;
            }
          }}
        />
      )}
    </div>
  );
};

export default HairstyleSection;
