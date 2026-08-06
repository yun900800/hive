import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, invoiceLineItems, members } from "@/lib/db/schema";
import { formatYuan, formatDateTime } from "@/lib/format";
import { AdminBillingActions } from "./admin-billing-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminBillingPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const rows = await db.select().from(invoices).orderBy(invoices.createdAt).all();
  const membersList = await db.select().from(members).all();
  const memberName = new Map(membersList.map((m) => [m.id, m.name]));
  const lines = await db.select().from(invoiceLineItems).all();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账单管理</h1>
          <p className="text-sm text-muted-foreground">查看账单、手动出账与模拟支付。</p>
        </div>
        <AdminBillingActions action="dispatch" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>快速出账</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminBillingActions action="generate" members={membersList.map((m) => ({ id: m.id, name: m.name }))} month={month} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会员</TableHead>
                <TableHead>月份</TableHead>
                <TableHead>总额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>支付时间</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    暂无账单
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((inv) => {
                  const itemCount = lines.filter((l) => l.invoiceId === inv.id).length;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{memberName.get(inv.memberId) ?? inv.memberId.slice(0, 8)}</TableCell>
                      <TableCell>{inv.billingMonth}</TableCell>
                      <TableCell>{formatYuan(inv.totalCents)}（{itemCount} 项）</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "PAID" ? "default" : "secondary"}>{inv.status}</Badge>
                      </TableCell>
                      <TableCell>{inv.paidAt ? formatDateTime(inv.paidAt) : "—"}</TableCell>
                      <TableCell className="text-right">
                        {inv.status !== "PAID" && (
                          <AdminBillingActions action="pay" invoiceId={inv.id} memberId={inv.memberId} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
