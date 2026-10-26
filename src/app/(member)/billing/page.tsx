import { redirect } from "next/navigation";
import { ChevronDown, CreditCard, Receipt, Wallet } from "lucide-react";

import { auth } from "@/auth";
import {
  listMyInvoices,
  getOutstandingBalance,
  getPaidTotal,
  ensureMonthlyInvoiceIfNeeded,
} from "@/modules/billing/application/billing-app";
import { formatYuan, formatDateTime } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { BillingActions } from "./billing-actions";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  await ensureMonthlyInvoiceIfNeeded(memberId);

  const [invoices, outstanding, paidTotal] = await Promise.all([
    listMyInvoices(memberId),
    getOutstandingBalance(memberId),
    getPaidTotal(memberId),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="账单与支付中心"
        description="查看月度出账、消费明细与模拟支付流程。"
        actions={<BillingActions action="generate" disabled={false} />}
      />

      <section aria-label="账单统计" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="待支付总额"
          value={formatYuan(outstanding)}
          icon={CreditCard}
          tone={outstanding > 0 ? "warning" : "success"}
          hint={outstanding > 0 ? "请尽快完成待付账单" : "所有账单已结清"}
        />
        <StatCard
          label="历史已支付总额"
          value={formatYuan(paidTotal)}
          icon={Wallet}
          tone="success"
          hint="累计成功付款金额"
        />
      </section>

      <section aria-labelledby="invoices-heading" className="space-y-4">
        <h2 id="invoices-heading" className="text-base font-semibold">
          账单历史
        </h2>

        {invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="暂无账单记录"
            description="点击右上角「生成本月账单」将当月产生的工位、会议室与灵活区费用汇总出账。"
          />
        ) : (
          <div className="space-y-4">
            {invoices.map((inv) => {
              const isPaid = inv.status === "PAID";
              return (
                <div
                  key={inv.id}
                  className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs ring-1 ring-foreground/[0.02]"
                >
                  <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-semibold">
                          {inv.billingMonth} 月度账单
                        </h3>
                        <StatusBadge kind="invoice" value={inv.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        出账时间：{formatDateTime(inv.createdAt)} · 缴费截止：{formatDateTime(inv.dueDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold tabular-nums">
                          {formatYuan(inv.totalCents)}
                        </p>
                      </div>
                      {!isPaid && <BillingActions action="pay" invoiceId={inv.id} />}
                    </div>
                  </div>

                  {inv.lineItems.length > 0 ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-t border-border/70 px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                          <Receipt className="size-4" aria-hidden />
                          消费明细（{inv.lineItems.length} 项）
                        </span>
                        <ChevronDown
                          className="size-4 transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <div className="border-t border-border/60 px-4 py-3 sm:px-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>消费类型</TableHead>
                              <TableHead>明细说明</TableHead>
                              <TableHead className="text-right">金额</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {inv.lineItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">
                                  <span className="inline-flex items-center rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand-ink">
                                    {labelOf("charge", item.chargeType)}
                                  </span>
                                </TableCell>
                                <TableCell className="whitespace-normal text-muted-foreground">
                                  {item.description}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  {formatYuan(item.amountCents)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  ) : (
                    <div className="border-t border-border/70 px-6 py-3 text-xs text-muted-foreground">
                      暂无消费明细
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
