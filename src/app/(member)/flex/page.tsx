import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listFlexZones } from "@/modules/facility/application/facility-app";
import { getActiveFlexSession } from "@/modules/booking/application/booking-app";
import { getActiveSubscription } from "@/modules/membership/application/membership-app";
import { formatDateTime } from "@/lib/format";
import { FlexCheckInForm } from "./flex-checkin-form";
import { FlexCheckOutForm } from "./flex-checkout-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const openZones = zones.filter((z) => z.status === "OPEN");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">灵活办公区</h1>
        <p className="text-sm text-muted-foreground">
          仅 FLEX_DESK 套餐会员可入场。入场后开始计时，离场结束会话。
        </p>
      </div>

      {!isFlexMember && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            当前套餐 {sub?.planType ?? "无"} 不具备灵活区权限，请先订阅 FLEX_DESK 套餐。
          </CardContent>
        </Card>
      )}

      {isFlexMember && activeSession && (
        <Card>
          <CardHeader>
            <CardTitle>当前在场</CardTitle>
            <CardDescription>
              入场时间 {formatDateTime(activeSession.checkInAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FlexCheckOutForm sessionId={activeSession.id} />
          </CardContent>
        </Card>
      )}

      {isFlexMember && !activeSession && (
        <Card>
          <CardHeader>
            <CardTitle>入场签到</CardTitle>
            <CardDescription>选择区域后签到，离场时自动结算时长</CardDescription>
          </CardHeader>
          <CardContent>
            <FlexCheckInForm zones={openZones.map((z) => ({ id: z.id, name: z.name, capacity: z.capacity }))} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
