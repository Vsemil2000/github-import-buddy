import { Button } from "@/components/ui/button";
import { CalendarDays, Sparkles, Lock } from "lucide-react";

interface WeeklyStylistProps {
  hasTokens: boolean;
  onUnlock: () => void;
}

const WeeklyStylist = ({ hasTokens, onUnlock }: WeeklyStylistProps) => {
  const suggestions = [
    { title: "Седмична визия", desc: "Персонална препоръка за тази седмица" },
    { title: "Прическа на седмицата", desc: "Нова прическа за Вашия тип" },
    { title: "Сезонни предложения", desc: "Актуални идеи за сезона" },
  ];

  return (
    <div className="hero-luxury rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="icon-circle w-8 h-8">
          <CalendarDays className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
        </div>
        <h3 className="font-semibold text-sm">Седмичен AI стилист</h3>
      </div>
      <p className="text-meta leading-relaxed">
        Нови идеи за Вас всяка седмица
      </p>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-xl transition-colors duration-200 hover:bg-background/50"
            style={{
              background: "hsl(var(--background) / 0.5)",
              border: "1px solid hsl(var(--border) / 0.2)",
            }}
          >
            <div className="space-y-0.5">
              <p className="text-xs font-medium">{s.title}</p>
              <p className="text-meta-label normal-case" style={{ textTransform: "none" }}>{s.desc}</p>
            </div>
            {hasTokens ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(var(--primary) / 0.5)" }} />
            ) : (
              <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            )}
          </div>
        ))}
      </div>
      {!hasTokens && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 rounded-full text-xs active:scale-[0.97] transition-transform"
          style={{ borderColor: "hsl(var(--accent-taupe) / 0.5)" }}
          onClick={onUnlock}
        >
          <Lock className="w-3 h-3" /> Отключи с токени
        </Button>
      )}
    </div>
  );
};

export default WeeklyStylist;
