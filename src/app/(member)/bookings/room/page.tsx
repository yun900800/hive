import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMeetingRooms } from "@/modules/facility/application/facility-app";
import { formatYuan } from "@/lib/format";
import { RoomBookingForm } from "./room-booking-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BookRoomPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const rooms = (await listMeetingRooms()).filter((r) => r.status === "AVAILABLE");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">预订会议室</h1>
        <p className="text-sm text-muted-foreground">
          所有会员可预订，按小时计费。超时 15 分钟内不额外收费。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>选择会议室与时段</CardTitle>
          <CardDescription>同一会议室同一时段不可重复预订</CardDescription>
        </CardHeader>
        <CardContent>
          <RoomBookingForm
            rooms={rooms.map((r) => ({
              id: r.id,
              name: r.name,
              capacity: r.capacity,
              equipments: r.equipments,
              hourlyRateYuan: r.hourlyRateCents / 100,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
