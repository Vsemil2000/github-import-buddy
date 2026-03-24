import { Button } from "@/components/ui/button";

interface AuthVerificationNoticeProps {
  email: string;
  loading: boolean;
  onResend: () => void;
}

const AuthVerificationNotice = ({ email, loading, onResend }: AuthVerificationNoticeProps) => {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Потвърдете имейла си</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ако имате профил с <span className="font-medium text-foreground">{email}</span>,
          входът ще работи след потвърждение на имейла. Ако писмото не е дошло, изпратете го отново.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full"
        onClick={onResend}
        disabled={loading}
      >
        {loading ? "Изпращане..." : "Изпрати нов потвърдителен имейл"}
      </Button>
    </div>
  );
};

export default AuthVerificationNotice;