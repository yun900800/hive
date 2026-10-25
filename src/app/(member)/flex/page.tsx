import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, DoorOpen, Lock, Sparkles, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { listFlexZones } from "@/modules/facility/application/facility-app";
import { getActiveFlexSession } from "@/modules/booking/application/booking-app";
import { getActiveSubscription } from "@/modules/membership/application/membership-app";
import { formatDateTime } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { FlexCheckInForm } from "./flex-checkin-form";
import { FlexCheckOutForm } from "./flex-checkout-form";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default async function FlexPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [zones, activeSession, sub] = await Promise.all([
    listFlexZones(),
    getActiveFlexSession(memberId),
    getActiveSubscription(memberId),
  ]);

  const isFlexMember = sub?.planType === "FLEX_DESK";
  const openZones = zones.filter((zone) => zone.status === "OPEN");
  const currentPlan = sub ? labelOf("planType", sub.planType) : "未订阅";

  return (
    <div className="space-y-8">
      <PageHeader
        title="灵活办公区"
        description="灵活办公位套餐会员可入场签到，离场时自动结算本次使用时长。"
      />

      {!isFlexMember ? (
        <SectionCard
          title="灵活区权限"
          description="灵活办公区仅对「灵活办公位」套餐开放。"
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                <Lock className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">当前套餐不支持灵活区签到</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  你当前使用的是 {currentPlan}。升级到灵活办公位后，即可选择区域签到入场。
                </p>
              </div>
            </div>
            <Link
              href="/subscription"
              className={cn(buttonVariants({ variant: "brand" }))}
            >
              查看套餐
              <ArrowRight className="ml-1.5 size-4" aria-hidden />
            </Link>
          </div>
        </SectionCard>
      ) : (
        <>
          <section aria-label="灵活区概览" className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="当前状态"
              value={activeSession ? "在场" : "未入场"}
              icon={DoorOpen}
              tone={activeSession ? "success" : "default"}
              hint={
                activeSession
                  ? `入场于 ${formatDateTime(activeSession.checkInAt)}`
                  : "签到后开始计时"
              }
            />
            <StatCard
              label="可用区域"
              value={openZones.length}
              icon={Sparkles}
              tone="brand"
              hint={`共 ${zones.length} 个区域`}
            />
            <StatCard
              label="当前套餐"
              value={currentPlan}
              icon={Wallet}
              hint="支持灵活区签到"
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              {activeSession ? (
                <SectionCard
                  title="当前在场"
                  description={`入场时间 ${formatDateTime(activeSession.checkInAt)}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                        <Clock className="size-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-medium">已签到入场</p>
                        <p className="text-xs text-muted-foreground">
                          离场后自动结算本次时长。
                        </p>
                      </div>
                    </div>
                    <FlexCheckOutForm sessionId={activeSession.id} />
                  </div>
                </SectionCard>
              ) : (
                <SectionCard
                  title="入场签到"
                  description="选择区域后签到，离场时自动结算时长。"
                >
                  <FlexCheckInForm
                    zones={openZones.map((zone) => ({
                      id: zone.id,
                      name: zone.name,
                      capacity: zone.capacity,
                    }))}
                  />
                </SectionCard>
              )}
            </div>

            <SectionCard
              title="区域状态"
              description="只有开放中的区域可以签到。"
            >
              {zones.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="暂无灵活区"
                  description="灵活区配置完成后会出现在这里。"
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <ul className="space-y-2.5">
                  {zones.map((zone) => (
                    <li
                      key={zone.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">
                          容量 {zone.capacity} 人
                        </p>
                      </div>
                      <StatusBadge kind="zoneStatus" value={zone.status} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
