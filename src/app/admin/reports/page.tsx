import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Armchair, DoorOpen, Receipt, Sparkles, Users } from "lucide-react";

import { db } from "@/lib/db";
import {
  deskBookings,
  flexSessions,
  invoiceLineItems,
  invoices,
  members,
  roomBookings,
} from "@/lib/db/schema";
import { count, eq, ne, sum } from "drizzle-orm";
import { formatYuan } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";
import { EmptyState } from "@/components/patterns/empty-state";
import { cn } from "@/lib/utils";

const BAR_COLORS = [
  "bg-brand",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export default async function AdminReportsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [monthlyRows, [memberCount], [deskCount], [roomCount], [flexCount], chargeRows] =
    await Promise.all([
      db
        .select({ month: invoices.billingMonth, total: sum(invoices.totalCents) })
        .from(invoices)
        .where(ne(invoices.status, "CANCELLED"))
        .groupBy(invoices.billingMonth)
        .all(),
      db.select({ v: count() }).from(members),
      db
        .select({ v: count() })
        .from(deskBookings)
        .where(ne(deskBookings.status, "CANCELLED")),
      db
        .select({ v: count() })
        .from(roomBookings)
        .where(ne(roomBookings.status, "CANCELLED")),
      db.select({ v: count() }).from(flexSessions),
      db
        .select({
          chargeType: invoiceLineItems.chargeType,
          total: sum(invoiceLineItems.amountCents),
        })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
        .where(ne(invoices.status, "CANCELLED"))
        .groupBy(invoiceLineItems.chargeType)
        .all(),
    ]);

  const months = [...monthlyRows].sort((a, b) => a.month.localeCompare(b.month));
  const maxMonthTotal = Math.max(
    1,
    ...months.map((row) => Number(row.total ?? 0))
  );

  const charges = [...chargeRows]
    .filter((row) => Number(row.total ?? 0) > 0)
    .sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0));
  const maxChargeTotal = Math.max(
    1,
    ...charges.map((row) => Number(row.total ?? 0))
  );
  const monthlyTotal = months.reduce(
    (sum, row) => sum + Number(row.total ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="经营报表"
        description="收入与资源使用情况概览。账单总额含待支付与逾期，不包含已取消账单。"
      />

      <section aria-label="关键指标" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="会员数"
          value={memberCount.v}
          icon={Users}
          tone="brand"
          hint="已建档会员"
        />
        <StatCard
          label="工位预订"
          value={deskCount.v}
          icon={Armchair}
          hint="不含已取消"
        />
        <StatCard
          label="会议室预订"
          value={roomCount.v}
          icon={DoorOpen}
          hint="不含已取消"
        />
        <StatCard
          label="灵活区会话"
          value={flexCount.v}
          icon={Sparkles}
          hint="含进行中与已完成"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="月度账单总额"
          description="按账单月份汇总，含待支付与逾期。"
          className="flex h-full flex-col"
          bodyClassName="flex flex-1 flex-col"
        >
          {months.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="暂无账单数据"
              description="生成账单后即可看到月度趋势。"
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              {months.map((row) => {
                const total = Number(row.total ?? 0);
                const width = Math.max(4, Math.round((total / maxMonthTotal) * 100));
                return (
                  <div key={row.month} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="font-medium tabular-nums">{row.month}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatYuan(total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-3 text-xs">
                <span className="text-muted-foreground">
                  合计（{months.length} 个月）
                </span>
                <span className="font-semibold tabular-nums">
                  {formatYuan(monthlyTotal)}
                </span>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="收入构成"
          description="按费用类型汇总所有未取消账单的明细。"
        >
          {charges.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="暂无收入明细"
              description="账单生成后即可看到费用构成。"
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <div className="space-y-4">
              {charges.map((row, index) => {
                const total = Number(row.total ?? 0);
                const width = Math.max(4, Math.round((total / maxChargeTotal) * 100));
                return (
                  <div key={row.chargeType} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="font-medium">
                        {labelOf("charge", row.chargeType)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatYuan(total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          BAR_COLORS[index % BAR_COLORS.length]
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
