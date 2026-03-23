import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Coins, LogOut, Eye, MessageCircle, Heart, LayoutDashboard, User } from "lucide-react";

interface AppHeaderProps {
  tokenBalance?: number;
  onShowShop?: () => void;
}

const AppHeader = ({ tokenBalance = 0, onShowShop }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const navItems = [
    { path: "/dashboard", label: "Начало", icon: LayoutDashboard },
    { path: "/studio", label: "Анализ", icon: Eye },
    { path: "/ai-stylist", label: "AI стилист", icon: MessageCircle },
    { path: "/cabinet", label: "Визии", icon: Heart },
    { path: "/profile", label: "Профил", icon: User },
  ];

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "linear-gradient(180deg, hsl(28 22% 91% / 0.96) 0%, hsl(28 22% 91% / 0.9) 100%)",
        borderBottom: "1px solid hsl(var(--accent-taupe) / 0.2)",
        backdropFilter: "blur(24px) saturate(1.2)",
        WebkitBackdropFilter: "blur(24px) saturate(1.2)",
        boxShadow: "0 1px 3px hsl(18 18% 14% / 0.03)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3.5 md:px-8">
        <h1
          className="text-lg font-semibold tracking-tight cursor-pointer transition-opacity duration-200 hover:opacity-80 active:scale-[0.98]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "hsl(var(--primary))" }}
          onClick={() => navigate("/dashboard")}
        >
          AI стилист
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowShop ? onShowShop : () => navigate("/studio")}
            className="flex items-center gap-1.5 text-xs font-semibold h-8 px-3.5 rounded-full transition-all duration-200 hover:shadow-premium active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, hsl(var(--accent-rose) / 0.45), hsl(var(--accent-gold) / 0.25))",
              border: "1px solid hsl(var(--accent-rose) / 0.25)",
              boxShadow: "inset 0 1px 0 hsl(30 40% 97% / 0.3)",
            }}
          >
            <Coins className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary) / 0.7)" }} />
            <span className="tabular-nums">{tokenBalance}</span>
          </button>
          <button
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-200 active:scale-[0.95]"
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <nav className="flex gap-0.5 px-4 md:px-8 pb-0.5 overflow-x-auto scrollbar-none">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-all duration-200 whitespace-nowrap touch-target active:scale-[0.97] ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                  style={{
                    background: "linear-gradient(90deg, hsl(var(--primary) / 0.8), hsl(var(--primary)))",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default AppHeader;
