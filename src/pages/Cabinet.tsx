import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Loader2, Trash2, Heart, Eye, Shirt, Scissors, Share2, X } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface GeneratedImage {
  id: string;
  image_url: string;
  image_type: string;
  style_name: string | null;
  is_favorite?: boolean;
  occasion?: string | null;
}

type FilterTab = "all" | "clothing" | "hairstyle" | "favorites";

const Cabinet = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [tokenBalance, setTokenBalance] = useState(0);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else {
        fetchImages();
        fetchTokens();
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchTokens = async () => {
    try {
      const { data } = await supabase.functions.invoke("check-tokens");
      setTokenBalance(data?.tokenBalance ?? 0);
    } catch {}
  };

  const fetchImages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("generated_images")
      .select("id, image_url, image_type, style_name, is_favorite, occasion")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Грешка при зареждане");
    } else {
      setImages((data as GeneratedImage[]) || []);
    }
    setLoading(false);
  };

  const getImageUrl = (img: GeneratedImage): string | null => {
    return img.image_url || null;
  };

  const downloadImage = async (img: GeneratedImage) => {
    const url = getImageUrl(img);
    if (!url) {
      toast.error("Няма налично изображение за изтегляне");
      return;
    }
    const name = img.style_name || "ai-stylist";
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success("Изтеглянето започна");
    } catch {
      window.open(url, "_blank");
      toast.info("Изображението е отворено в нов таб");
    }
  };

  const shareImage = async (img: GeneratedImage) => {
    const url = getImageUrl(img);
    if (!url) {
      toast.error("Няма налично изображение за споделяне");
      return;
    }
    const title = img.style_name || "Визия";

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Линкът е копиран в клипборда");
    } catch {
      toast.error("Не може да се копира линка");
    }
  };

  const deleteImage = async (id: string) => {
    const { error } = await supabase.from("generated_images").delete().eq("id", id);
    if (error) {
      toast.error("Грешка при изтриване");
    } else {
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Снимката е изтрита");
    }
  };

  const toggleFavorite = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("generated_images")
      .update({ is_favorite: !current })
      .eq("id", id);
    if (error) {
      toast.error("Грешка при запазване");
    } else {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, is_favorite: !current } : img))
      );
    }
  };

  const filteredImages = images.filter((img) => {
    if (filter === "all") return true;
    if (filter === "favorites") return img.is_favorite;
    if (filter === "clothing") return img.image_type === "fitting" || img.image_type === "flatlay";
    if (filter === "hairstyle") return img.image_type === "hairstyle";
    return true;
  });

  const TABS: { id: FilterTab; label: string; icon: any }[] = [
    { id: "all", label: "Всички", icon: Eye },
    { id: "clothing", label: "Облекло", icon: Shirt },
    { id: "hairstyle", label: "Прически", icon: Scissors },
    { id: "favorites", label: "Любими", icon: Heart },
  ];

  const getTypeLabel = (type: string) => {
    if (type === "fitting") return "Пробна";
    if (type === "hairstyle") return "Прическа";
    return "Разгъвка";
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader tokenBalance={tokenBalance} />

      <main className="max-w-2xl mx-auto px-4 py-6 md:px-6">
        <h2 className="text-display-sm font-bold mb-5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Моите визии
        </h2>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-1.5 whitespace-nowrap ${
                filter === id ? "chip-luxury-active" : "chip-luxury-default"
              }`}
              onClick={() => setFilter(id)}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-16 space-y-4 slide-up">
            <div className="icon-circle w-16 h-16 mx-auto">
              <Heart className="w-7 h-7" style={{ color: "hsl(var(--primary) / 0.5)" }} />
            </div>
            <p className="text-muted-foreground text-sm">
              {filter === "favorites" ? "Все още нямате любими визии" : "Все още нямате запазени визии"}
            </p>
            <Button className="rounded-full shadow-luxury active:scale-[0.97] transition-transform" onClick={() => navigate("/studio")}>
              Създайте първата визия
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredImages.map((img) => (
              <div key={img.id} className="premium-card overflow-hidden group">
                <div className="aspect-[3/4] overflow-hidden relative">
                  <img
                    src={img.image_url}
                    alt={img.style_name || "Визия"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02] cursor-pointer"
                    loading="lazy"
                    onClick={() => setSelectedImage(img)}
                  />
                  {/* Type badge */}
                  <span
                    className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      background: "hsl(var(--background) / 0.85)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid hsl(var(--border) / 0.2)",
                    }}
                  >
                    {getTypeLabel(img.image_type)}
                  </span>
                  {img.is_favorite && (
                    <span className="absolute top-2.5 right-2.5">
                      <Heart className="w-4 h-4 fill-red-400 text-red-400 drop-shadow-sm" />
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="font-medium text-xs truncate">{img.style_name || "Визия"}</p>
                  <div className="flex gap-0.5">
                    <button
                      className="p-2 rounded-lg hover:bg-secondary transition-colors touch-target"
                      onClick={() => toggleFavorite(img.id, !!img.is_favorite)}
                    >
                      <Heart className={`w-3.5 h-3.5 ${img.is_favorite ? "fill-red-400 text-red-400" : "text-muted-foreground"}`} />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-secondary transition-colors touch-target"
                      onClick={() => downloadImage(img)}
                    >
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-secondary transition-colors touch-target"
                      onClick={() => shareImage(img)}
                    >
                      <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors touch-target ml-auto"
                      onClick={() => deleteImage(img.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Image Preview Modal */}
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-lg p-0 overflow-hidden border-none bg-transparent shadow-none [&>button]:hidden">
            {selectedImage && (
              <div className="premium-card overflow-hidden">
                <div className="relative">
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.style_name || "Визия"}
                    className="w-full max-h-[70vh] object-contain bg-background"
                  />
                  <button
                    className="absolute top-3 right-3 p-2 rounded-full transition-colors"
                    style={{
                      background: "hsl(var(--background) / 0.85)",
                      backdropFilter: "blur(8px)",
                    }}
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="w-4 h-4 text-foreground" />
                  </button>
                  <span
                    className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      background: "hsl(var(--background) / 0.85)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid hsl(var(--border) / 0.2)",
                    }}
                  >
                    {getTypeLabel(selectedImage.image_type)}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="font-semibold text-sm">{selectedImage.style_name || "Визия"}</p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 rounded-full text-xs active:scale-[0.97] transition-transform"
                      onClick={() => {
                        toggleFavorite(selectedImage.id, !!selectedImage.is_favorite);
                        setSelectedImage((prev) => prev ? { ...prev, is_favorite: !prev.is_favorite } : null);
                      }}
                    >
                      <Heart className={`w-3.5 h-3.5 ${selectedImage.is_favorite ? "fill-red-400 text-red-400" : ""}`} />
                      {selectedImage.is_favorite ? "Премахни" : "Любима"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 rounded-full text-xs active:scale-[0.97] transition-transform"
                      onClick={() => downloadImage(selectedImage)}
                    >
                      <Download className="w-3.5 h-3.5" /> Изтегли
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 rounded-full text-xs active:scale-[0.97] transition-transform"
                      onClick={() => shareImage(selectedImage)}
                    >
                      <Share2 className="w-3.5 h-3.5" /> Сподели
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                    onClick={() => {
                      deleteImage(selectedImage.id);
                      setSelectedImage(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Изтрий визията
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Cabinet;
