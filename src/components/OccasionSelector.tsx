import { Briefcase, Heart, Coffee, Plane, Award, UserCheck, Sun as SunIcon, Snowflake, CalendarDays } from "lucide-react";

interface OccasionSelectorProps {
  onSelect: (occasion: string) => void;
  selected?: string;
}

const OCCASIONS = [
  { id: "work", label: "Работа", icon: Briefcase },
  { id: "date", label: "Среща", icon: Heart },
  { id: "casual", label: "Ежедневие", icon: Coffee },
  { id: "travel", label: "Пътуване", icon: Plane },
  { id: "formal", label: "Официално", icon: Award },
  { id: "interview", label: "Интервю", icon: UserCheck },
  { id: "weekend", label: "Уикенд", icon: CalendarDays },
  { id: "summer", label: "Лято", icon: SunIcon },
  { id: "winter", label: "Зима", icon: Snowflake },
];

const OccasionSelector = ({ onSelect, selected }: OccasionSelectorProps) => {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Изберете повод</h4>
      <div className="flex flex-wrap gap-2">
        {OCCASIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`flex items-center gap-1.5 ${selected === id ? "chip-luxury-active" : "chip-luxury-default"}`}
            onClick={() => onSelect(id)}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OccasionSelector;
