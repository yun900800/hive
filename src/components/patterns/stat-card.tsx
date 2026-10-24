import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "default" | "brand" | "success" | "warning" | "danger";

const TONE_ICON: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-ink",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
};

const TONE_VALUE: Record<Tone, string> = {
  default: "text-foreground",
  brand: "text-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card p-5 ring-1 ring-foreground/[0.02]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              TONE_ICON[tone]
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
          TONE_VALUE[tone]
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
