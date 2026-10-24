import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq, sum } from "drizzle-orm";
import {
  ArrowRight,
  Armchair,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  DoorOpen,
  Users,
  Wallet,
} from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  deskBookings,
  desks,
  flexZones,
  gates,
  invoices,
  meetingRooms,
  members,
  roomBookings,
} from "@/lib/db/schema";
import { formatYuan } from "@/lib/format";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";

const QUICK_LINKS = [
  {
    href: "/admin/facility",
    label: "空间资源",
    description: "工位、会议室、灵活区与闸机设备",
    icon: Building2,
  },
  {
    href: "/admin/members",
    label: "会员管理",
    description: "会员档案、角色与订阅状态",
    icon: Users,
  },
  {
    href: "/admin/billing",
    label: "账单管理",
    description: "手动出账、模拟支付与事件冲刷",
    icon: CreditCard,
  },
  {
    href: "/admin/reports",
    label: "经营报表",
    description: "收入构成与空间使用情况",
    icon: BarChart3,
  },
];

export default async function AdminDashboardPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [
    [deskCount],
    [roomCount],
    [zoneCount],
    [gateCount],
    [memberCount],
    [availableDeskCount],
    [availableRoomCount],
    [paidSum],
    [pendingSum],
    [pendingCount],
    [deskBookingCount],
    [roomBookingCount],
  ] = await Promise.all([
    db.select({ v: count() }).from(desks),
    db.select({ v: count() }).from(meetingRooms),
    db.select({ v: count() }).from(flexZones),
    db.select({ v: count() }).from(gates),
    db.select({ v: count() }).from(members),
    db
      .select({ v: count() })
      .from(desks)
      .where(eq(desks.status, "AVAILABLE")),
    db
      .select({ v: count() })
      .from(meetingRooms)
      .where(eq(meetingRooms.status, "AVAILABLE")),
    db
      .select({ v: sum(invoices.totalCents) })
      .from(invoices)
      .where(eq(invoices.status, "PAID")),
    db
      .select({ v: sum(invoices.totalCents) })
      .from(invoices)
      .where(eq(invoices.status, "PENDING")),
    db
      .select({ v: count() })
      .from(invoices)
      .where(eq(invoices.status, "PENDING")),
    db.select({ v: count() }).from(deskBookings),
    db.select({ v: count() }).from(roomBookings),
  ]);

  const paidRevenue = Number(paidSum.v ?? 0);
  const pendingRevenue = Number(pendingSum.v ?? 0);
  const totalBookings = deskBookingCount.v + roomBookingCount.v;

  return (
    <div className="space-y-10">
      <PageHeader
        title="经营总览"
        description={`空间资源、会员与资金的整体情况。当前共 ${zoneCount.v} 个灵活区、${gateCount.v} 台闸机设备。`}
        actions={
          <Link
            href="/admin/reports"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            查看报表
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />

      <section
        aria-label="关键指标"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard
          label="会员总数"
          value={memberCount.v}
          icon={Users}
          tone="brand"
          hint="已建档会员"
        />
        <StatCard
          label="工位"
          value={deskCount.v}
          icon={Armchair}
          hint={`${availableDeskCount.v} 个当前可预订`}
        />
        <StatCard
          label="会议室 / 办公室"
          value={roomCount.v}
          icon={DoorOpen}
          hint={`${availableRoomCount.v} 间当前可用`}
        />
        <StatCard
          label="已收金额"
          value={formatYuan(paidRevenue)}
          icon={Wallet}
          tone="success"
          hint="累计已支付账单"
        />
        <StatCard
          label="待收金额"
          value={formatYuan(pendingRevenue)}
          icon={CreditCard}
          tone={pendingRevenue > 0 ? "warning" : "default"}
          hint={
            pendingCount.v > 0
              ? `${pendingCount.v} 张账单待支付`
              : "没有待支付账单"
          }
        />
        <StatCard
          label="预订总量"
          value={totalBookings}
          icon={CalendarDays}
          hint={`工位 ${deskBookingCount.v} · 会议室 ${roomBookingCount.v}`}
        />
      </section>

      <section aria-labelledby="quick-links" className="space-y-4">
        <div>
          <h2 id="quick-links" className="text-base font-semibold">
            快捷入口
          </h2>
          <p className="text-sm text-muted-foreground">
            常用的后台管理功能。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {link.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {link.description}
                  </span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-strong"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
