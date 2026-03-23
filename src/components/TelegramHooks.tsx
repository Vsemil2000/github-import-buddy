import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { TELEGRAM_BOT_URL } from "@/config/app";

interface TelegramHooksProps {
  variant?: "inline" | "card";
}

const TelegramHooks = ({ variant = "inline" }: TelegramHooksProps) => {
  const handleTelegram = (action: string) => {
    window.open(TELEGRAM_BOT_URL, "_blank");
    toast.info("Отваряме Telegram...");
  };

  if (variant === "card") {
    return (
      <div className="premium-card-featured p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="icon-circle w-8 h-8">
            <Send className="w-3.5 h-3.5 text-foreground/60" />
          </div>
          <h4 className="font-semibold text-sm">Telegram</h4>
        </div>
        <p className="text-meta leading-relaxed">
          Получавайте седмични стилови идеи и управлявайте токени през Telegram.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2 rounded-full text-xs active:scale-[0.97] transition-transform"
            style={{ borderColor: "hsl(var(--accent-taupe) / 0.5)" }}
            onClick={() => handleTelegram("open")}
          >
            <Send className="w-3 h-3" /> Отвори бота
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2 rounded-full text-xs active:scale-[0.97] transition-transform"
            style={{ borderColor: "hsl(var(--accent-taupe) / 0.5)" }}
            onClick={() => handleTelegram("weekly")}
          >
            <Send className="w-3 h-3" /> Получи седмични идеи
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="p-2 rounded-lg hover:bg-secondary/60 transition-all duration-200 touch-target active:scale-[0.93]"
      onClick={() => handleTelegram("send")}
    >
      <Send className="w-3.5 h-3.5 text-muted-foreground" />
    </button>
  );
};

export default TelegramHooks;
