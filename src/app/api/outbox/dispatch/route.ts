import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dispatchOutboxEvents } from "@/shared/outbox";
import "@/modules/billing/application/bootstrap";
import "@/modules/notification/application/bootstrap";

/**
 * POST /api/outbox/dispatch —— 手动冲刷 Outbox 事件（仅管理员）。
 * 事件驱动计费的触发点：无 cron 时由管理员/出账流程手动调用。
 */
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const result = await dispatchOutboxEvents();
  return NextResponse.json(result);
}
