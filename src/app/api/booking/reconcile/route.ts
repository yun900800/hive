import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { reconcileOverdueBookings } from "@/modules/booking/application/booking-app";

/**
 * 预订逾期巡检：
 * - GET  —— GitHub Actions / Cron 调用（定期兜底），认证：Authorization: Bearer CRON_SECRET
 * - POST —— 管理员手动触发，认证：admin session
 *
 * 到期未签退的工位预订 → CHECKED_OUT（checkedOutAt 记为预订结束时间）；
 * 确认后 15 分钟仍未签到 → NO_SHOW。幂等，可重复执行。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const result = await reconcileOverdueBookings();
  return NextResponse.json(result);
}

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const result = await reconcileOverdueBookings();
  return NextResponse.json(result);
}
