import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  footer,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card ring-1 ring-foreground/[0.02]",
        className
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
      {footer && (
        <div className="border-t border-border/70 px-5 py-3">{footer}</div>
      )}
    </section>
  );
}
