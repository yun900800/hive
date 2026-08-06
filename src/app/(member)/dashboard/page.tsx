import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getMember,
  getActiveSubscription,
  listPlans,
} from "@/modules/membership/application/membership-app";
import { formatYuan, formatDate } from "@/lib/format";

export default async function MemberDashboardPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member, sub, plans] = await Promise.all([
    getMember(session.user.memberId),
    getActiveSubscription(session.user.memberId),
    listPlans(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">你好，{member?.name}</h1>
        <p className="text-sm text-muted-foreground">
          欢迎回到蜂巢。这里是你的会员概览。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-background p-6">
          <p className="text-sm text-muted-foreground">会员等级</p>
          <p className="mt-1 text-2xl font-bold">{member?.tier ?? "—"}</p>
        </div>
        <div className="rounded-xl border bg-background p-6">
          <p className="text-sm text-muted-foreground">信用分</p>
          <p className="mt-1 text-2xl font-bold">{member?.creditScore ?? "—"}</p>
        </div>
        <div className="rounded-xl border bg-background p-6">
          <p className="text-sm text-muted-foreground">当前套餐</p>
          <p className="mt-1 text-2xl font-bold">
            {sub ? sub.planType : "未订阅"}
          </p>
          {sub && (
            <p className="mt-1 text-xs text-muted-foreground">
              月费 {formatYuan(sub.monthlyFeeCents)} · 至 {formatDate(sub.endDate)}
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">可选套餐</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border bg-background p-6">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">{formatYuan(p.monthlyFeeCents)}</p>
              <p className="text-xs text-muted-foreground">/月</p>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
