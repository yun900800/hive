import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

/** 路由级加载骨架：页头 + 统计卡 + 内容卡 */
export function PageSkeleton({
  stats = 4,
  rows = 6,
}: {
  stats?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-80" />
      </div>

      {stats > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-border/80 bg-card p-5"
            >
              <Bar className="h-3.5 w-16" />
              <Bar className="h-7 w-24" />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border/80 bg-card p-5">
        <Bar className="h-4 w-32" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: rows }).map((_, index) => (
            <Bar key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
