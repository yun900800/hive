import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getMember,
  getActiveSubscription,
} from "@/modules/membership/application/membership-app";
import { formatYuan, formatDate } from "@/lib/format";
import { cancelSubscriptionAction } from "@/modules/membership/interface/actions/subscribe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member, sub] = await Promise.all([
    getMember(session.user.memberId),
    getActiveSubscription(session.user.memberId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">个人中心</h1>
        <p className="text-sm text-muted-foreground">管理你的会员资料与订阅。</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>会员资料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">姓名</span>
              <span>{member?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">邮箱</span>
              <span>{member?.email ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">手机号</span>
              <span>{member?.phone || "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">会员等级</span>
              <span className="font-medium">{member?.tier ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">信用分</span>
              <span>{member?.creditScore ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前订阅</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {sub ? (
              <>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">套餐</span>
                  <span className="font-medium">{sub.planType}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">月费</span>
                  <span>{formatYuan(sub.monthlyFeeCents)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">起止</span>
                  <span>
                    {formatDate(sub.startDate)} ~ {formatDate(sub.endDate)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">状态</span>
                  <span className="text-emerald-600">{sub.status}</span>
                </div>
                <form action={cancelSubscriptionAction}>
                  <Button type="submit" variant="outline" size="sm">
                    取消当前套餐
                  </Button>
                </form>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  你还没有订阅任何套餐，去选择一款适合你的办公方案吧。
                </p>
                <a
                  href="/subscription"
                  className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  选择套餐
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
