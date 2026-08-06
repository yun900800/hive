import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listPlans,
  getActiveSubscription,
} from "@/modules/membership/application/membership-app";
import { formatYuan } from "@/lib/format";
import { subscribePlanAction } from "@/modules/membership/interface/actions/subscribe";
import { SubscribeForm } from "./subscribe-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [plans, activeSub] = await Promise.all([
    listPlans(),
    getActiveSubscription(session.user.memberId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">订阅套餐</h1>
        <p className="text-sm text-muted-foreground">
          {activeSub
            ? `当前生效：${activeSub.planType}（月费 ${formatYuan(activeSub.monthlyFeeCents)}）`
            : "选择一款套餐，开启你的蜂巢办公体验。"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <p className="text-3xl font-bold">{formatYuan(p.monthlyFeeCents)}</p>
              <p className="text-xs text-muted-foreground">/月</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <SubscribeForm planId={p.id} disabled={!!activeSub} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
