import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { desks, meetingRooms, flexZones, gates, members, invoices, deskBookings, roomBookings } from "@/lib/db/schema";
import { count, sum, eq } from "drizzle-orm";
import { formatYuan } from "@/lib/format";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [[deskCount], [roomCount], [zoneCount], [gateCount], [memberCount], [invoiceSum]] =
    await Promise.all([
      db.select({ v: count() }).from(desks),
      db.select({ v: count() }).from(meetingRooms),
      db.select({ v: count() }).from(flexZones),
      db.select({ v: count() }).from(gates),
      db.select({ v: count() }).from(members),
      db.select({ v: sum(invoices.totalCents) }).from(invoices).where(eq(invoices.status, "PAID")),
    ]);

  const stats = [
    { label: "工位", value: deskCount.v },
    { label: "会议室", value: roomCount.v },
    { label: "灵活区", value: zoneCount.v },
    { label: "闸机", value: gateCount.v },
    { label: "会员", value: memberCount.v },
  ];

  const revenue = Number(invoiceSum.v ?? 0);
  const totalBookings = deskCount.v + roomCount.v;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">管理概览</h1>
        <p className="text-sm text-muted-foreground">空间资源、会员与经营总体情况。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-background p-6">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-background p-6">
          <p className="text-sm text-muted-foreground">已收金额</p>
          <p className="mt-1 text-3xl font-bold">{formatYuan(revenue)}</p>
        </div>
        <div className="rounded-xl border bg-background p-6">
          <p className="text-sm text-muted-foreground">预订量</p>
          <p className="mt-1 text-3xl font-bold">{totalBookings}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background p-6">
          <h2 className="mb-2 font-semibold">空间资源</h2>
          <p className="text-sm text-muted-foreground">
            管理工位、会议室、灵活办公区与闸机设备。
          </p>
          <a
            href="/admin/facility"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            进入空间资源
          </a>
        </div>
        <div className="rounded-xl border bg-background p-6">
          <h2 className="mb-2 font-semibold">会员管理</h2>
          <p className="text-sm text-muted-foreground">查看会员档案与订阅状态。</p>
          <a
            href="/admin/members"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            进入会员管理
          </a>
        </div>
        <div className="rounded-xl border bg-background p-6">
          <h2 className="mb-2 font-semibold">账单管理</h2>
          <p className="text-sm text-muted-foreground">手动出账、模拟支付与事件冲刷。</p>
          <a
            href="/admin/billing"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            进入账单管理
          </a>
        </div>
        <div className="rounded-xl border bg-background p-6">
          <h2 className="mb-2 font-semibold">报表</h2>
          <p className="text-sm text-muted-foreground">查看收入构成与资源使用情况。</p>
          <a
            href="/admin/reports"
            className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            进入报表
          </a>
        </div>
      </div>
    </div>
  );
}
