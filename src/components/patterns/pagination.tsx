import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  totalItems,
  prevHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  prevHref: string;
  nextHref: string;
}) {
  if (totalPages <= 1) return null;

  const disabledClass = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "pointer-events-none min-h-11 opacity-50 sm:min-h-0"
  );
  const linkClass = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "min-h-11 sm:min-h-0"
  );

  return (
    <nav
      aria-label="分页"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted-foreground">
        第 {page} / {totalPages} 页 · 共 {totalItems} 条
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={prevHref} className={linkClass}>
            <ChevronLeft className="mr-1 size-4" aria-hidden />
            上一页
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            <ChevronLeft className="mr-1 size-4" aria-hidden />
            上一页
          </span>
        )}
        {page < totalPages ? (
          <Link href={nextHref} className={linkClass}>
            下一页
            <ChevronRight className="ml-1 size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            下一页
            <ChevronRight className="ml-1 size-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
