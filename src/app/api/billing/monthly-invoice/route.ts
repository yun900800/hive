import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateMonthlyInvoice } from "@/modules/billing/application/billing-app";
import { dispatchOutboxEvents } from "@/shared/outbox";
import "@/modules/billing/application/bootstrap";
import "@/modules/access/application/bootstrap";
import "@/modules/notification/application/bootstrap";

/**
 * 月度自动出账：
 * - GET  —— Vercel Cron 调用（每月 1 日），认证：Authorization: Bearer CRON_SECRET
 * - POST —— 管理员手动触发，认证：admin session
 * 遍历所有 ACTIVE 订阅会员，为当月生成/追加账单，最后冲刷 outbox 事件（通知）。
 */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function runMonthlyInvoicing() {
  const month = currentMonth();
  const activeSubs = await db
    .select({ memberId: subscriptions.memberId })
    .from(subscriptions)
    .where(eq(subscriptions.status, "ACTIVE"))
    .all();

  const results: Array<{ memberId: string; invoiceId?: string; totalCents?: number; error?: string }> = [];
  for (const s of activeSubs) {
    try {
      const inv = await generateMonthlyInvoice(s.memberId, month);
      results.push({ memberId: s.memberId, invoiceId: inv.id, totalCents: inv.totalCents });
    } catch (e) {
      results.push({ memberId: s.memberId, error: e instanceof Error ? e.message : "出账失败" });
    }
  }
  // 冲刷本次出账发布的事件（invoice-issued → 通知）
  await dispatchOutboxEvents();
  return { month, processed: results.length, results };
}

export async function GET(request: Request) {
  // Vercel Cron 认证：Authorization: Bearer CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const result = await runMonthlyInvoicing();
  return NextResponse.json(result);
}

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const result = await runMonthlyInvoicing();
  return NextResponse.json(result);
}