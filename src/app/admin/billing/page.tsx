import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CreditCard, Receipt, Wallet } from "lucide-react";

import { db } from "@/lib/db";
import { invoices, invoiceLineItems, members } from "@/lib/db/schema";
import { formatYuan, formatDateTime } from "@/lib/format";
import { AdminBillingActions } from "./admin-billing-actions";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
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

export default async function AdminBillingPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [rows, membersList, lines] = await Promise.all([
    db.select().from(invoices).all(),
    db.select().from(members).all(),
    db.select().from(invoiceLineItems).all(),
  ]);

  const memberName = new Map(membersList.map((member) => [member.id, member.name]));
  const itemCountByInvoice = new Map<string, number>();
  for (const line of lines) {
    itemCountByInvoice.set(
      line.invoiceId,
      (itemCountByInvoice.get(line.invoiceId) ?? 0) + 1
    );
  }

  const paidTotal = rows
    .filter((invoice) => invoice.status === "PAID")
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const pendingRows = rows.filter(
    (invoice) =>
      invoice.status === "PENDING" || invoice.status === "OVERDUE"
  );
  const pendingTotal = pendingRows.reduce(
    (sum, invoice) => sum + invoice.totalCents,
    0
  );

  const sortedRows = [...rows].sort(
    (a, b) =>
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="账单管理"
        description="查看全部账单、手动出账与模拟支付。支付后会同步写入消费记录。"
        actions={<AdminBillingActions action="dispatch" />}
      />

      <section aria-label="账单概览" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="已收金额"
          value={formatYuan(paidTotal)}
          icon={Wallet}
          tone="success"
          hint={`${rows.filter((row) => row.status === "PAID").length} 张已支付账单`}
        />
        <StatCard
          label="待收金额"
          value={formatYuan(pendingTotal)}
          icon={CreditCard}
          tone={pendingTotal > 0 ? "warning" : "default"}
          hint={`${pendingRows.length} 张账单待处理`}
        />
        <StatCard
          label="账单总数"
          value={rows.length}
          icon={Receipt}
          hint="含历史与取消的账单"
          className="col-span-2 sm:col-span-1"
        />
      </section>

      <SectionCard
        title="快速出账"
        description="为指定会员生成月度账单，已存在同月账单时不会重复创建。"
      >
        <AdminBillingActions
          action="generate"
          members={membersList.map((member) => ({
            id: member.id,
            name: member.name,
          }))}
          month={month}
        />
      </SectionCard>

      <SectionCard
        title="账单列表"
        description={`共 ${rows.length} 张账单，按出账时间倒序排列。`}
        bodyClassName="p-0"
      >
        {sortedRows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="还没有账单"
            description="使用上方「快速出账」为会员生成第一张月度账单。"
            className="border-0 bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>会员</TableHead>
                  <TableHead className="hidden sm:table-cell">账单月份</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="hidden lg:table-cell">支付时间</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((invoice) => {
                  const itemCount = itemCountByInvoice.get(invoice.id) ?? 0;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {memberName.get(invoice.memberId) ?? "已删除会员"}
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">
                        {invoice.billingMonth}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatYuan(invoice.totalCents)}
                        <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">
                          （{itemCount} 项）
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="invoice" value={invoice.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {invoice.paidAt ? formatDateTime(invoice.paidAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.status !== "PAID" && (
                          <AdminBillingActions
                            action="pay"
                            invoiceId={invoice.id}
                            memberId={invoice.memberId}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
