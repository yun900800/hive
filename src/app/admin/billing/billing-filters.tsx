import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { labelOf } from "@/lib/labels";
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

export const INVOICE_STATUS_VALUES = [
  "PENDING",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

const STATUS_ITEMS: Record<string, string> = {
  ALL: "全部状态",
  ...Object.fromEntries(
    INVOICE_STATUS_VALUES.map((status) => [status, labelOf("invoice", status)])
  ),
};

export function BillingFilters({
  month,
  status,
  memberId,
  members,
  resultCount,
}: {
  month?: string;
  status?: string;
  memberId?: string;
  members: Array<{ id: string; name: string }>;
  resultCount: number;
}) {
  const memberItems: Record<string, string> = {
    ALL: "全部会员",
    ...Object.fromEntries(members.map((member) => [member.id, member.name])),
  };

  return (
    <SectionCard
      title="筛选账单"
      description="按月份、状态或会员筛选，条件会保留在 URL 中。"
      action={
        <span
          aria-live="polite"
          aria-atomic="true"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          共 {resultCount} 张
        </span>
      }
    >
      <form
        method="get"
        action="/admin/billing"
        aria-label="账单筛选"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="billing-month">账单月份</Label>
          <Input
            id="billing-month"
            name="month"
            type="month"
            defaultValue={month}
            className="h-11 w-full sm:h-9 sm:w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="billing-status">状态</Label>
          <Select
            name="status"
            defaultValue={status ?? "ALL"}
            items={STATUS_ITEMS}
          >
            <SelectTrigger id="billing-status" className="h-11 w-full sm:h-9 sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="billing-member">会员</Label>
          <Select
            name="memberId"
            defaultValue={memberId ?? "ALL"}
            items={memberItems}
          >
            <SelectTrigger id="billing-member" className="h-11 w-full sm:h-9 sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(memberItems).map(([value, label]) => (
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
            href="/admin/billing"
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
