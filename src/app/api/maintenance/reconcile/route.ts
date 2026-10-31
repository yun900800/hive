import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { reconcileOverdueBookings } from "@/modules/booking/application/booking-app";
import { expireOldPasses } from "@/modules/access/application/access-app";

/**
 * 逾期巡检（统一入口）：
 * - GET  —— GitHub Actions / Cron 调用（定期兜底），认证：Authorization: Bearer CRON_SECRET
 * - POST —— 管理员手动触发，认证：admin session
 *
 * 一次性收尾所有「忘记操作」的记录，全部幂等：
 * - 工位：到期未签退 → CHECKED_OUT；确认后 15 分钟未到 → NO_SHOW
 * - 灵活区：跨天仍 ACTIVE → COMPLETED（签退记为当日 23:59:59）
 * - 会议室：到点未完成 → COMPLETED（不产生超时费）
 * - 通行证：超过有效期仍 ACTIVE → EXPIRED
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const bookings = await reconcileOverdueBookings();
  const passesExpired = await expireOldPasses();
  return NextResponse.json({ ...bookings, passesExpired });
}

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const bookings = await reconcileOverdueBookings();
  const passesExpired = await expireOldPasses();
  return NextResponse.json({ ...bookings, passesExpired });
}
