import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, invoiceLineItems, deskBookings, roomBookings, flexSessions, members } from "@/lib/db/schema";
import { count, sum, eq, ne } from "drizzle-orm";
import { formatYuan } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminReportsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  // 月度收入：按账单月份汇总（非取消状态）
  const paidRows = await db
    .select({ month: invoices.billingMonth, total: sum(invoices.totalCents) })
    .from(invoices)
    .where(ne(invoices.status, "CANCELLED"))
    .groupBy(invoices.billingMonth)
    .all();

  const [[memberCount], [deskCount], [roomCount], [flexCount]] = await Promise.all([
    db.select({ v: count() }).from(members),
    db.select({ v: count() }).from(deskBookings).where(ne(deskBookings.status, "CANCELLED")),
    db.select({ v: count() }).from(roomBookings).where(ne(roomBookings.status, "CANCELLED")),
    db.select({ v: count() }).from(flexSessions),
  ]);

  const roomLines = await db
    .select({ month: invoices.billingMonth, total: sum(invoiceLineItems.amountCents) })
    .from(invoiceLineItems)
    .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
    .groupBy(invoices.billingMonth)
    .all();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">经营报表</h1>
        <p className="text-sm text-muted-foreground">收入与资源使用情况概览。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="会员数" value={String(memberCount.v)} />
        <StatCard label="工位预订（非取消）" value={String(deskCount.v)} />
        <StatCard label="会议室预订（非取消）" value={String(roomCount.v)} />
        <StatCard label="灵活区会话" value={String(flexCount.v)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>月度账单收入</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">账单总额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paidRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">暂无账单</TableCell>
                  </TableRow>
                ) : (
                  paidRows.map((r) => (
                    <TableRow key={r.month}>
                      <TableCell>{r.month}</TableCell>
                      <TableCell className="text-right">{formatYuan(Number(r.total ?? 0))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>月度收入构成</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">收入</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">暂无数据</TableCell>
                  </TableRow>
                ) : (
                  roomLines.map((r) => (
                    <TableRow key={r.month}>
                      <TableCell>{r.month}</TableCell>
                      <TableCell className="text-right">{formatYuan(Number(r.total ?? 0))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}
