import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dispatchOutboxEvents } from "@/shared/outbox";
import "@/modules/billing/application/bootstrap";
import "@/modules/access/application/bootstrap";
import "@/modules/notification/application/bootstrap";

/**
 * 冲刷 Outbox 事件：
 * - GET  —— Vercel Cron 调用（定期兜底），认证：Authorization: Bearer CRON_SECRET
 * - POST —— 管理员手动触发，认证：admin session
 * 事件驱动计费的触发点：操作时已自愈冲刷，cron 兜底处理滞留事件。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const result = await dispatchOutboxEvents();
  return NextResponse.json(result);
}

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const result = await dispatchOutboxEvents();
  return NextResponse.json(result);
}
