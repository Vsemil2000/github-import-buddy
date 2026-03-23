import { Sparkles, Eye, Shirt, Scissors, Star, Heart, MessageCircle, CalendarDays } from "lucide-react";

interface NextStepPanelProps {
  context: "clothing" | "hairstyle";
  onAction: (action: string) => void;
}

const NextStepPanel = ({ context, onAction }: NextStepPanelProps) => {
  const actions = [
    ...(context === "clothing"
      ? [
          { id: "more_looks", label: "Покажи още визии", icon: Eye },
          { id: "more_elegant", label: "Направи по-елегантно", icon: Sparkles },
          { id: "more_casual", label: "Направи по-небрежно", icon: Shirt },
          { id: "combine_hairstyle", label: "Комбинирай с прическа", icon: Scissors },
        ]
      : [
          { id: "more_hairstyles", label: "Покажи още прически", icon: Scissors },
          { id: "more_elegant", label: "Направи по-елегантно", icon: Sparkles },
          { id: "more_casual", label: "Направи по-небрежно", icon: Shirt },
          { id: "combine_outfit", label: "Комбинирай с outfit", icon: Shirt },
        ]),
    { id: "total_look", label: "Създай цялостна визия", icon: Star },
    { id: "occasion", label: "Визия за конкретен повод", icon: CalendarDays },
    { id: "save_profile", label: "Запази в профила", icon: Heart },
    { id: "ask_stylist", label: "Попитай AI стилиста", icon: MessageCircle },
  ];

  return (
    <div className="premium-card-featured p-6 space-y-4 slide-up">
      <h3 className="text-base font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Какво искате да направим сега?
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {actions.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border/40 text-sm font-medium text-left transition-all duration-200 active:scale-[0.97] touch-target"
            style={{ background: "hsl(var(--surface-warm))" }}
            onClick={() => onAction(id)}
          >
            <Icon className="w-4 h-4 shrink-0 text-primary/60" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NextStepPanel;
