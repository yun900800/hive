import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/patterns/section-card";
import {
  BOOKING_TYPE_OPTIONS,
  getStatusLabel,
  getStatusOptions,
  type BookingStatusGroup,
  type BookingType,
} from "./filters";

function buildHref({
  type,
  status,
  from,
  to,
}: {
  type?: BookingType;
  status?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const query = params.toString();
  return query ? `/bookings?${query}` : "/bookings";
}

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
    active
      ? "border-brand bg-brand-soft text-brand-ink"
      : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-foreground"
  );
}

export function BookingFilterBar({
  type,
  statusGroup,
  from,
  to,
  resultCount,
}: {
  type?: BookingType;
  statusGroup?: BookingStatusGroup;
  from?: string;
  to?: string;
  resultCount: number;
}) {
  const statusOptions = getStatusOptions(type);

  return (
    <SectionCard
      title="筛选预订"
      description="按类型、状态或开始日期筛选，条件会保留在 URL 中。"
      action={
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          共 {resultCount} 条
        </span>
      }
    >
      <div className="space-y-4">
        <div
          role="group"
          aria-label="按预订类型筛选"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            类型
          </span>
          <Link
            href={buildHref({ from, to })}
            aria-current={!type ? "page" : undefined}
            className={chipClass(!type)}
          >
            全部
          </Link>
          {BOOKING_TYPE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={buildHref({ type: option.value, from, to })}
              aria-current={type === option.value ? "page" : undefined}
              className={chipClass(type === option.value)}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div
          role="group"
          aria-label="按预订状态筛选"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            状态
          </span>
          <Link
            href={buildHref({ type, from, to })}
            aria-current={!statusGroup ? "page" : undefined}
            className={chipClass(!statusGroup)}
          >
            全部
          </Link>
          {statusOptions.map((group) => (
            <Link
              key={group.value}
              href={buildHref({ type, status: group.value, from, to })}
              aria-current={statusGroup?.value === group.value ? "page" : undefined}
              className={chipClass(statusGroup?.value === group.value)}
            >
              {getStatusLabel(group, type)}
            </Link>
          ))}
        </div>

        <form
          key={`${from ?? ""}:${to ?? ""}`}
          method="get"
          action="/bookings"
          className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-end"
        >
          {type && <input type="hidden" name="type" value={type} />}
          {statusGroup && (
            <input type="hidden" name="status" value={statusGroup.value} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              开始日期
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="h-9 w-full sm:w-40"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              结束日期
            </Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="h-9 w-full sm:w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="brand" size="sm">
              应用时间
            </Button>
            <Link
              href="/bookings"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" })
              )}
            >
              重置
            </Link>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
