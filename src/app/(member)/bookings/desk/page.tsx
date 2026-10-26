import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { auth } from "@/auth";
import { listDesks } from "@/modules/facility/application/facility-app";
import { DeskBookingForm } from "./desk-booking-form";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function BookDeskPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const desks = (await listDesks()).filter((d) => d.status === "AVAILABLE");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="预订固定工位"
        description="适用于固定工位/独立办公室套餐会员。预订开始前 30 分钟内不可取消。"
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
        title="选择工位与时段"
        description="同一工位同一时段不可重复预订。"
        action={
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink">
            {desks.length} 个可用
          </span>
        }
      >
        <DeskBookingForm
          desks={desks.map((d) => ({
            id: d.id,
            code: d.code,
            floor: d.floor,
            zone: d.zone,
          }))}
        />
      </SectionCard>
    </div>
  );
}
