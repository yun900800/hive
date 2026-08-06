import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import * as booking from "@/modules/booking/application/booking-app";
import { formatDateTime } from "@/lib/format";
import { BookingActions } from "./booking-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [deskList, roomList, flexList] = await Promise.all([
    booking.listMyDeskBookings(memberId),
    booking.listMyRoomBookings(memberId),
    booking.listMyFlexSessions(memberId),
  ]);

  const rows: Array<{
    key: string;
    type: "DESK" | "ROOM" | "FLEX";
    resource: string;
    start: Date;
    end: Date;
    status: string;
  }> = [
    ...deskList.map((b) => ({
      key: `d-${b.id}`,
      type: "DESK" as const,
      resource: `工位 ${b.deskId.slice(0, 8)}`,
      start: b.startTime,
      end: b.endTime,
      status: b.status,
    })),
    ...roomList.map((b) => ({
      key: `r-${b.id}`,
      type: "ROOM" as const,
      resource: `会议室 ${b.roomId.slice(0, 8)}`,
      start: b.startTime,
      end: b.endTime,
      status: b.status,
    })),
    ...flexList.map((s) => ({
      key: `f-${s.id}`,
      type: "FLEX" as const,
      resource: `灵活区 ${s.zoneId.slice(0, 8)}`,
      start: s.checkInAt,
      end: s.checkOutAt ?? s.checkInAt,
      status: s.status,
    })),
  ].sort((a, b) => b.start.getTime() - a.start.getTime());

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的预订</h1>
          <p className="text-sm text-muted-foreground">工位、会议室与灵活区使用记录。</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/bookings/desk"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            订工位
          </Link>
          <Link
            href="/bookings/room"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            订会议室
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无预订记录。去预订一个工位或会议室，或前往灵活区签到入场。
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>资源</TableHead>
                  <TableHead>时段</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-40 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <Badge variant="outline">{row.type}</Badge>
                    </TableCell>
                    <TableCell>{row.resource}</TableCell>
                    <TableCell>
                      {formatDateTime(row.start)} ~ {formatDateTime(row.end)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "CONFIRMED" || row.status === "ACTIVE" || row.status === "IN_PROGRESS"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <BookingActions type={row.type} id={row.key.slice(2)} status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
