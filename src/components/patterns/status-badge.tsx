import { cn } from "@/lib/utils";
import {
  getStatusMeta,
  type LabelKind,
  type StatusTone,
} from "@/lib/labels";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  brand: "bg-brand-soft text-brand-ink ring-brand/30",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const DOT_CLASS: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  brand: "bg-brand",
  neutral: "bg-muted-foreground/50",
};

export function StatusBadge({
  kind,
  value,
  label,
  tone,
  className,
}: {
  kind: LabelKind;
  value?: string | null;
  /** 覆盖默认文案（例如「当前套餐」场景） */
  label?: string;
  tone?: StatusTone;
  className?: string;
}) {
  const meta = getStatusMeta(kind, value);
  const resolvedTone = tone ?? meta.tone;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASS[resolvedTone],
        className
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", DOT_CLASS[resolvedTone])}
      />
      {label ?? meta.label}
    </span>
  );
}
