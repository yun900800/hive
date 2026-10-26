import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";

import { auth } from "@/auth";
import * as booking from "@/modules/booking/application/booking-app";
import {
  listDesks,
  listFlexZones,
  listMeetingRooms,
} from "@/modules/facility/application/facility-app";
import { formatDateTime } from "@/lib/format";
import { BookingActions } from "./booking-actions";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
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

const TYPE_LABELS: Record<
  string,
  { label: string; kind: "deskBooking" | "roomBooking" | "flexSession" }
> = {
  DESK: { label: "固定工位", kind: "deskBooking" },
  ROOM: { label: "会议室", kind: "roomBooking" },
  FLEX: { label: "灵活区", kind: "flexSession" },
};

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [deskList, roomList, flexList, desks, rooms, zones] =
    await Promise.all([
      booking.listMyDeskBookings(memberId),
      booking.listMyRoomBookings(memberId),
      booking.listMyFlexSessions(memberId),
      listDesks(),
      listMeetingRooms(),
      listFlexZones(),
    ]);

  const deskById = new Map(desks.map((desk) => [desk.id, desk]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

  const rows = [
    ...deskList.map((b) => {
      const desk = deskById.get(b.deskId);
      return {
        key: `d-${b.id}`,
        id: b.id,
        type: "DESK" as const,
        resourceName: desk?.code ?? "未知工位",
        resourceMeta: desk ? `${desk.floor} 层 · ${desk.zone} 区` : "资源已删除",
        start: b.startTime,
        end: b.endTime,
        status: b.status,
        kind: "deskBooking" as const,
      };
    }),
    ...roomList.map((b) => {
      const room = roomById.get(b.roomId);
      return {
        key: `r-${b.id}`,
        id: b.id,
        type: "ROOM" as const,
        resourceName: room?.name ?? "未知会议室",
        resourceMeta: room ? `容量 ${room.capacity} 人` : "资源已删除",
        start: b.startTime,
        end: b.endTime,
        status: b.status,
        kind: "roomBooking" as const,
      };
    }),
    ...flexList.map((s) => {
      const zone = zoneById.get(s.zoneId);
      return {
        key: `f-${s.id}`,
        id: s.id,
        type: "FLEX" as const,
        resourceName: zone?.name ?? "未知区域",
        resourceMeta: zone ? `容量 ${zone.capacity} 人` : "资源已删除",
        start: s.checkInAt,
        end: s.checkOutAt,
        status: s.status,
        kind: "flexSession" as const,
      };
    }),
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
              <Plus className="mr-1.5 size-4" aria-hidden />
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
        <SectionCard
          title="预订记录"
          description="预订与使用记录会出现在这里。"
        >
          <EmptyState
            icon={CalendarDays}
            title="暂无预订记录"
            description="你还没有创建过工位或会议室预订，或者前往灵活区签到入场。"
            className="border-0 bg-transparent py-10"
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
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  预订会议室
                </Link>
              </div>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard
          title="预订记录"
          description={`共 ${rows.length} 条，按开始时间倒序。`}
          bodyClassName="p-0"
        >
          <Table className="[&_th:first-child]:pl-5 [&_th:last-child]:pr-5 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
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
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {row.resourceName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.resourceMeta}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.start)} ~{" "}
                      {row.end ? formatDateTime(row.end) : "进行中"}
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
        </SectionCard>
      )}
    </div>
  );
}
