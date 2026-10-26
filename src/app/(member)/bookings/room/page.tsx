import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { auth } from "@/auth";
import { listMeetingRooms } from "@/modules/facility/application/facility-app";
import { RoomBookingForm } from "./room-booking-form";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function BookRoomPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const rooms = (await listMeetingRooms()).filter(
    (r) => r.status === "AVAILABLE"
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="预订会议室"
        description="所有会员可预订，按小时计费。超时 15 分钟内不额外收费。"
        actions={
          <Link
            href="/bookings"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <CalendarDays className="mr-1.5 size-4" aria-hidden />
            我的预订
          </Link>
        }
      />

      <SectionCard
        title="选择会议室与时段"
        description="同一会议室同一时段不可重复预订。"
        action={
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink">
            {rooms.length} 间可用
          </span>
        }
      >
        <RoomBookingForm
          rooms={rooms.map((r) => ({
            id: r.id,
            name: r.name,
            capacity: r.capacity,
            equipments: r.equipments,
            hourlyRateYuan: r.hourlyRateCents / 100,
          }))}
        />
      </SectionCard>
    </div>
  );
}
