import { Fragment } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ChevronDown, CreditCard, Receipt, Search, Wallet } from "lucide-react";

import { db } from "@/lib/db";
import { invoices, invoiceLineItems, members } from "@/lib/db/schema";
import { formatYuan, formatDateTime } from "@/lib/format";
import { monthKey } from "@/shared/clock";
import { labelOf } from "@/lib/labels";
import {
  buildQueryString,
  clampPage,
  firstParam,
  parsePage,
} from "@/lib/search-params";
import { AdminBillingActions } from "./admin-billing-actions";
import { BillingFilters, INVOICE_STATUS_VALUES } from "./billing-filters";
import { PageHeader } from "@/components/patterns/page-header";
import { Pagination } from "@/components/patterns/pagination";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/empty-state";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [rows, membersList, lines] = await Promise.all([
    db.select().from(invoices).all(),
    db.select().from(members).all(),
    db.select().from(invoiceLineItems).all(),
  ]);

  const memberName = new Map(membersList.map((member) => [member.id, member.name]));
  const linesByInvoice = new Map<string, typeof lines>();
  for (const line of lines) {
    linesByInvoice.set(line.invoiceId, [
      ...(linesByInvoice.get(line.invoiceId) ?? []),
      line,
    ]);
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

  const params = await searchParams;
  const monthParam = firstParam(params.month);
  const monthFilter =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : undefined;
  const statusParam = firstParam(params.status);
  const statusFilter =
    statusParam &&
    (INVOICE_STATUS_VALUES as readonly string[]).includes(statusParam)
      ? statusParam
      : undefined;
  const memberParam = firstParam(params.memberId);
  const memberFilter =
    memberParam && memberName.has(memberParam) ? memberParam : undefined;

  const filteredRows = sortedRows.filter((invoice) => {
    if (monthFilter && invoice.billingMonth !== monthFilter) return false;
    if (statusFilter && invoice.status !== statusFilter) return false;
    if (memberFilter && invoice.memberId !== memberFilter) return false;
    return true;
  });
  const hasFilters = Boolean(monthFilter || statusFilter || memberFilter);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = clampPage(parsePage(firstParam(params.page)), totalPages);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const filterQuery = {
    month: monthFilter,
    status: statusFilter,
    memberId: memberFilter,
  };
  const prevHref = `/admin/billing${buildQueryString({
    ...filterQuery,
    page: currentPage > 2 ? currentPage - 1 : undefined,
  })}`;
  const nextHref = `/admin/billing${buildQueryString({
    ...filterQuery,
    page: currentPage < totalPages ? currentPage + 1 : undefined,
  })}`;

  const currentMonth = monthKey();

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

      <p className="text-xs text-muted-foreground" role="note">
        统计卡为全量账单口径，不受下方筛选影响。
      </p>

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
          month={currentMonth}
        />
      </SectionCard>

      {rows.length > 0 && (
        <BillingFilters
          month={monthFilter}
          status={statusFilter}
          memberId={memberFilter}
          members={membersList.map((member) => ({
            id: member.id,
            name: member.name,
          }))}
          resultCount={filteredRows.length}
        />
      )}

      <SectionCard
        title="账单列表"
        description={`共 ${filteredRows.length} 张账单${hasFilters ? `（全部 ${rows.length} 张）` : ""}，按出账时间倒序排列。`}
        bodyClassName="p-0"
        footer={
          filteredRows.length > 0 ? (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              prevHref={prevHref}
              nextHref={nextHref}
            />
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="还没有账单"
            description="使用上方「快速出账」为会员生成第一张月度账单。"
            className="border-0 bg-transparent"
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="没有符合条件的账单"
            description="调整月份、状态或会员筛选后再试。"
            action={
              <Link
                href="/admin/billing"
                className={buttonVariants({ variant: "brand", size: "sm" })}
              >
                清除筛选
              </Link>
            }
            className="border-0 bg-transparent"
          />
        ) : (
          <>
            <ul className="divide-y divide-border/70 sm:hidden">
              {pageRows.map((invoice) => {
                const invoiceLines = linesByInvoice.get(invoice.id) ?? [];
                const itemCount = invoiceLines.length;
                return (
                  <li key={invoice.id} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {memberName.get(invoice.memberId) ?? "已删除会员"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {invoice.billingMonth} · {itemCount} 项
                        </p>
                      </div>
                      <StatusBadge kind="invoice" value={invoice.status} />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold tabular-nums">
                        {formatYuan(invoice.totalCents)}
                      </p>
                      {invoice.status !== "PAID" && (
                        <AdminBillingActions
                          action="pay"
                          invoiceId={invoice.id}
                          memberId={invoice.memberId}
                        />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      支付时间：
                      {invoice.paidAt ? formatDateTime(invoice.paidAt) : "—"}
                    </p>

                    <details className="group rounded-lg border border-border/60 bg-muted/20">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                        <span>消费明细（{itemCount} 项）</span>
                        <ChevronDown
                          className="size-3.5 transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <div className="border-t border-border/60 px-3 py-2">
                        {invoiceLines.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            暂无消费明细
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {invoiceLines.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-start justify-between gap-3 text-xs"
                              >
                                <span className="min-w-0">
                                  <span className="inline-flex items-center rounded-md bg-brand-soft px-2 py-0.5 text-brand-ink">
                                    {labelOf("charge", item.chargeType)}
                                  </span>
                                  <span className="mt-1 block text-muted-foreground">
                                    {item.description}
                                  </span>
                                </span>
                                <span className="shrink-0 font-medium tabular-nums">
                                  {formatYuan(item.amountCents)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>

            <div className="hidden sm:block">
            <Table containerClassName="lg:overflow-x-clip">
              <TableHeader className="sticky top-16 z-10 [&_th]:bg-card">
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
                {pageRows.map((invoice) => {
                  const invoiceLines = linesByInvoice.get(invoice.id) ?? [];
                  const itemCount = invoiceLines.length;
                  return (
                    <Fragment key={invoice.id}>
                      <TableRow>
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
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <details className="group border-t border-border/60">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                              <span>消费明细（{itemCount} 项）</span>
                              <ChevronDown
                                className="size-3.5 transition-transform group-open:rotate-180"
                                aria-hidden
                              />
                            </summary>
                            <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                              {invoiceLines.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  暂无消费明细
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>消费类型</TableHead>
                                      <TableHead>明细说明</TableHead>
                                      <TableHead className="text-right">
                                        金额
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {invoiceLines.map((item) => (
                                      <TableRow key={item.id}>
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
                              )}
                            </div>
                          </details>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
