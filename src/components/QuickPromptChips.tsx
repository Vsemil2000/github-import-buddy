interface QuickPromptChipsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  pendingPrompt?: string | null;
}

const PROMPTS = [
  "Какво да облека за работа?",
  "Дай ми подходяща прическа",
  "Покажи ми по-елегантна визия",
  "Какво ми подхожда най-много?",
  "Направи ми визия за среща",
  "Покажи ми летни идеи",
  "Дай ми лесна за поддръжка прическа",
  "Комбинирай прическа и outfit",
];

const QuickPromptChips = ({ onSelect, disabled, pendingPrompt }: QuickPromptChipsProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {PROMPTS.map((prompt) => {
        const isPending = pendingPrompt === prompt;
        return (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            disabled={disabled || isPending}
            className={`chip-luxury-default transition-opacity ${disabled || isPending ? "opacity-50 pointer-events-none" : ""}`}
          >
            {isPending ? "⏳ " : ""}{prompt}
          </button>
        );
      })}
    </div>
  );
};

export default QuickPromptChips;
