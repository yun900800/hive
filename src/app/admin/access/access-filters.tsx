import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/patterns/section-card";

const RESULT_ITEMS: Record<string, string> = {
  ALL: "全部结果",
  GRANTED: "已放行",
  DENIED: "拒绝",
};

const DIRECTION_ITEMS: Record<string, string> = {
  ALL: "全部方向",
  ENTRY: "入场",
  EXIT: "离场",
};

export function AccessFilters({
  result,
  direction,
  date,
  gate,
  gates,
  resultCount,
}: {
  result?: string;
  direction?: string;
  date?: string;
  gate?: string;
  gates: string[];
  resultCount: number;
}) {
  const gateItems: Record<string, string> = {
    ALL: "全部闸机",
    ...Object.fromEntries(gates.map((name) => [name, name])),
  };

  return (
    <SectionCard
      title="筛选通行记录"
      description="按结果、方向、日期或闸机筛选，条件会保留在 URL 中。"
      action={
        <span
          aria-live="polite"
          aria-atomic="true"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          共 {resultCount} 条
        </span>
      }
    >
      <form
        method="get"
        action="/admin/access"
        aria-label="通行记录筛选"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="access-date">日期</Label>
          <Input
            id="access-date"
            name="date"
            type="date"
            defaultValue={date}
            className="h-11 w-full sm:h-9 sm:w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="access-result">结果</Label>
          <Select
            name="result"
            defaultValue={result ?? "ALL"}
            items={RESULT_ITEMS}
          >
            <SelectTrigger id="access-result" className="h-11 w-full sm:h-9 sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RESULT_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="access-direction">方向</Label>
          <Select
            name="direction"
            defaultValue={direction ?? "ALL"}
            items={DIRECTION_ITEMS}
          >
            <SelectTrigger id="access-direction" className="h-11 w-full sm:h-9 sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIRECTION_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="access-gate">闸机</Label>
          <Select name="gate" defaultValue={gate ?? "ALL"} items={gateItems}>
            <SelectTrigger id="access-gate" className="h-11 w-full sm:h-9 sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(gateItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="brand"
            size="sm"
            className="min-h-11 sm:min-h-0"
          >
            应用筛选
          </Button>
          <Link
            href="/admin/access"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-h-11 sm:min-h-0"
            )}
          >
            重置
          </Link>
        </div>
      </form>
    </SectionCard>
  );
}
