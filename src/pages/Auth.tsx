import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { TELEGRAM_BOT_URL } from "@/config/app";

const Auth = () => {
  const navigate = useNavigate();

  return (
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
      </div>
    </div>
  );
};

export default Auth;
