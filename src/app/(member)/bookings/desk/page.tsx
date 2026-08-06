import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDesks } from "@/modules/facility/application/facility-app";
import { DeskBookingForm } from "./desk-booking-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BookDeskPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const desks = (await listDesks()).filter((d) => d.status === "AVAILABLE");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">预订固定工位</h1>
        <p className="text-sm text-muted-foreground">
          适用于固定工位/独立办公室套餐会员。预订开始前 30 分钟内不可取消。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>选择工位与时段</CardTitle>
          <CardDescription>同一工位同一时段不可重复预订</CardDescription>
        </CardHeader>
        <CardContent>
          <DeskBookingForm desks={desks.map((d) => ({ id: d.id, code: d.code, floor: d.floor, zone: d.zone }))} />
        </CardContent>
      </Card>
    </div>
  );
}
