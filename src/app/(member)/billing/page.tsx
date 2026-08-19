import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listMyInvoices,
  getOutstandingBalance,
  getPaidTotal,
  ensureMonthlyInvoiceIfNeeded,
} from "@/modules/billing/application/billing-app";
import { formatYuan, formatDateTime } from "@/lib/format";
import { BillingActions } from "./billing-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  // 惰性出账兜底：无 Cron 环境下，访问账单页时自动生成当月账单（幂等）
  await ensureMonthlyInvoiceIfNeeded(memberId);
  const [invoices, outstanding, paidTotal] = await Promise.all([
    listMyInvoices(memberId),
    getOutstandingBalance(memberId),
    getPaidTotal(memberId),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账单与支付</h1>
          <p className="text-sm text-muted-foreground">
            月度出账，包含会员费与按次使用费。支付为模拟流程。
          </p>
        </div>
        <BillingActions action="generate" disabled={false} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">待支付总额</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatYuan(outstanding)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">已支付总额</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">{formatYuan(paidTotal)}</CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无账单。点击右上角「生成本月账单」将当前使用的费用汇总成账。
          </CardContent>
        </Card>
      ) : (
        invoices.map((inv) => (
          <Card key={inv.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{inv.billingMonth} 账单</CardTitle>
                  <CardDescription>
                    出账 {formatDateTime(inv.createdAt)} · 截止 {formatDateTime(inv.dueDate)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={inv.status === "PAID" ? "default" : "secondary"}>
                    {inv.status}
                  </Badge>
                  <span className="text-xl font-bold">{formatYuan(inv.totalCents)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">消费明细</h3>
                {inv.status !== "PAID" && (
                  <BillingActions action="pay" invoiceId={inv.id} />
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lineItems.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline">{line.chargeType}</Badge>
                      </TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right">{formatYuan(line.amountCents)}</TableCell>
                    </TableRow>
                  ))}
                  {inv.discountAppliedCents > 0 && (
                    <TableRow>
                      <TableCell />
                      <TableCell>会员折扣（{Math.round(inv.discountRate * 100)} 折）</TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatYuan(inv.discountAppliedCents)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-semibold">
                    <TableCell />
                    <TableCell>合计</TableCell>
                    <TableCell className="text-right">{formatYuan(inv.totalCents)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
