import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { ScanLine, ShieldAlert, ShieldCheck, Ticket } from "lucide-react";

import { listRecentAccessLogs } from "@/modules/access/application/access-app";
import { db } from "@/lib/db";
import { gatePasses, members } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
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

export default async function AdminAccessPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [logs, [passCount], membersList] = await Promise.all([
    listRecentAccessLogs(200),
    db.select({ v: count() }).from(gatePasses),
    db.select({ id: members.id, name: members.name }).from(members).all(),
  ]);

  const memberName = new Map(membersList.map((member) => [member.id, member.name]));
  const granted = logs.filter((log) => log.result === "GRANTED").length;
  const denied = logs.length - granted;

  return (
    <div className="space-y-8">
      <PageHeader
        title="通行管理"
        description="查看最近 200 条闸机通行记录与通行证发放情况。"
      />

      <section aria-label="通行概览" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="通行证总数"
          value={passCount.v}
          icon={Ticket}
          tone="brand"
          hint="历史累计发放"
        />
        <StatCard
          label="最近记录"
          value={logs.length}
          icon={ScanLine}
          hint="最近 200 条"
        />
        <StatCard
          label="放行次数"
          value={granted}
          icon={ShieldCheck}
          tone="success"
          hint="验证通过并放行"
        />
        <StatCard
          label="拒绝次数"
          value={denied}
          icon={ShieldAlert}
          tone={denied > 0 ? "danger" : "default"}
          hint="过期、撤销或无效编码"
        />
      </section>

      <SectionCard
        title="最近通行记录"
        description="按通行时间倒序排列。"
        bodyClassName="p-0"
      >
        {logs.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title="暂无通行记录"
            description="会员在闸机扫码后，记录会实时出现在这里。"
            className="border-0 bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>通行时间</TableHead>
                  <TableHead>会员</TableHead>
                  <TableHead className="hidden sm:table-cell">闸机</TableHead>
                  <TableHead className="hidden sm:table-cell">方向</TableHead>
                  <TableHead>结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDateTime(log.accessTime)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.memberId
                        ? (memberName.get(log.memberId) ?? "未知会员")
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {log.gateName}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
                        {log.direction === "ENTRY" ? "入场" : "离场"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="accessResult" value={log.result} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
