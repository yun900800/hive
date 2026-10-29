import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket } from "lucide-react";

import { auth } from "@/auth";
import {
  listMyGatePasses,
  listMyAccessLogs,
} from "@/modules/access/application/access-app";
import { formatDateTime } from "@/lib/format";
import { ScanForm } from "./scan-form";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
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
import { cn } from "@/lib/utils";

export default async function AccessPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [passes, logs] = await Promise.all([
    listMyGatePasses(memberId),
    listMyAccessLogs(memberId),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="通行证与闸机"
        description="预订确认后自动生成通行凭证。可在闸机前模拟扫码通行或查看历史记录。"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：通行证票券卡网格 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">我的通行凭证</h2>
            <span className="text-xs text-muted-foreground">共 {passes.length} 张通行证</span>
          </div>

          {passes.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="暂无有效通行证"
              description="前往预订工位或会议室后，系统将自动为你签发对应时段的通行证。"
              action={
                <Link
                  href="/bookings"
                  className={cn("inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-xs hover:bg-brand/90")}
                >
                  去预订工位
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {passes.map((p) => {
                const isActive = p.status === "ACTIVE";
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all",
                      isActive ? "border-brand/40 shadow-xs ring-1 ring-brand/20" : "border-border/80 opacity-75"
                    )}
                  >
                    {/* 左侧品牌色装饰条 */}
                    <div
                      aria-hidden
                      className={cn(
                        "absolute left-0 inset-y-0 w-1.5",
                        isActive ? "bg-brand" : "bg-muted-foreground/30"
                      )}
                    />
                    <div className="pl-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">
                          {p.code}
                        </span>
                        <StatusBadge kind="gatePass" value={p.status} />
                      </div>
                      <p className="mt-2 text-base font-semibold">
                        {p.gatePassType === "DESK" ? "固定工位通行凭证" : p.gatePassType === "ROOM" ? "会议室通行凭证" : "灵活区通行凭证"}
                      </p>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                        <p>生效：{formatDateTime(p.validFrom)}</p>
                        <p>截止：{formatDateTime(p.validTo)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧：模拟扫码 */}
        <SectionCard
          title="模拟闸机扫码"
          description="输入或选择已有通行证编码进行闸机核销。"
          bodyClassName="pt-4"
        >
          <ScanForm activePasses={passes.filter((p) => p.status === "ACTIVE").map((p) => p.code)} />
        </SectionCard>
      </div>

      {/* 底部：通行日志 */}
      <SectionCard
        title="通行历史记录"
        description="最近的闸机刷卡放行与拒绝日志。"
      >
        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无通行记录。</p>
        ) : (
          <Table containerClassName="lg:overflow-x-clip">
            <TableHeader className="sticky top-16 z-10 [&_th]:bg-card">
              <TableRow>
                  <TableHead>通行时间</TableHead>
                  <TableHead>闸机名称</TableHead>
                  <TableHead>方向</TableHead>
                  <TableHead>通行结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-foreground">
                      {formatDateTime(l.accessTime)}
                    </TableCell>
                    <TableCell>{l.gateName}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
                        {l.direction === "ENTRY" ? "入场" : "离场"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="accessResult" value={l.result} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
