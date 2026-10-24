import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";

import { auth } from "@/auth";
import * as booking from "@/modules/booking/application/booking-app";
import { formatDateTime } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { BookingActions } from "./booking-actions";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { StatusBadge } from "@/components/patterns/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, { label: string; kind: "deskBooking" | "roomBooking" | "flexSession" }> = {
  DESK: { label: "固定工位", kind: "deskBooking" },
  ROOM: { label: "会议室", kind: "roomBooking" },
  FLEX: { label: "灵活区", kind: "flexSession" },
};

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [deskList, roomList, flexList] = await Promise.all([
    booking.listMyDeskBookings(memberId),
    booking.listMyRoomBookings(memberId),
    booking.listMyFlexSessions(memberId),
  ]);

  const rows = [
    ...deskList.map((b) => ({
      key: `d-${b.id}`,
      id: b.id,
      type: "DESK" as const,
      resource: `工位编号：${b.deskId.slice(0, 8)}`,
      start: b.startTime,
      end: b.endTime,
      status: b.status,
      kind: "deskBooking" as const,
    })),
    ...roomList.map((b) => ({
      key: `r-${b.id}`,
      id: b.id,
      type: "ROOM" as const,
      resource: `会议室：${b.roomId.slice(0, 8)}`,
      start: b.startTime,
      end: b.endTime,
      status: b.status,
      kind: "roomBooking" as const,
    })),
    ...flexList.map((s) => ({
      key: `f-${s.id}`,
      id: s.id,
      type: "FLEX" as const,
      resource: `灵活区：${s.zoneId.slice(0, 8)}`,
      start: s.checkInAt,
      end: s.checkOutAt ?? s.checkInAt,
      status: s.status,
      kind: "flexSession" as const,
    })),
  ].sort((a, b) => b.start.getTime() - a.start.getTime());

  return (
    <div className="space-y-8">
      <PageHeader
        title="我的预订"
        description="查看并管理你的工位、会议室与灵活区使用记录。"
        actions={
          <>
            <Link
              href="/bookings/desk"
              className={cn(buttonVariants({ variant: "brand" }))}
            >
              <Plus className="size-4 mr-1.5" aria-hidden />
              订工位
            </Link>
            <Link
              href="/bookings/room"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              订会议室
            </Link>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="暂无预订记录"
          description="你还没有创建过工位或会议室预订，或者前往灵活区签到入场。"
          action={
            <div className="flex gap-2">
              <Link
                href="/bookings/desk"
                className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
              >
                立即订工位
              </Link>
              <Link
                href="/bookings/room"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                预订会议室
              </Link>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs ring-1 ring-foreground/[0.02]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>资源对象</TableHead>
                <TableHead>起止时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const typeMeta = TYPE_LABELS[row.type];
                return (
                  <TableRow key={row.key}>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {typeMeta?.label ?? row.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {row.resource}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.start)} ~ {formatDateTime(row.end)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind={row.kind} value={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <BookingActions
                        type={row.type}
                        id={row.id}
                        status={row.status}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
