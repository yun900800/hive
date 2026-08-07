import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  usageRecords,
  invoices,
  invoiceLineItems,
  subscriptions,
  plans,
  members,
  meetingRooms,
} from "@/lib/db/schema";
import { appendOutboxEvents, dispatchOutboxEvents } from "@/shared/outbox";
import { createEvent } from "@/shared/events";
import {
  calculateFlexUsage,
  calculateRoomUsage,
  calculateDeskUsage,
  applyFlexMonthlyCap,
  memberTierDiscountRate,
} from "../domain/rate-policy";
import { calculateRoomOvertime } from "../domain/overtime-policy";
import {
  aggregateLineItems,
  buildInvoice,
  markInvoicePaid,
} from "../domain/invoice";
import type { ChargeType, Invoice, InvoiceLineItem, UsageRecord } from "../domain/types";

/**
 * BillingApplicationService — 计费用例编排。
 * 领域规则由 domain/ 纯函数保证；事件订阅见 billing-subscribers.ts。
 */

// ---------- 工具 ----------

const HOUR_MS = 3_600_000;

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

/** 幂等写入使用记录（唯一索引 chargeType+referenceId 防重复） */
async function insertUsage(params: {
  memberId: string;
  chargeType: ChargeType;
  description: string;
  referenceId: string;
  durationMs: number;
  unitRateCents: number;
  amountCents: number;
  occurredAt: Date;
}): Promise<void> {
  await db
    .insert(usageRecords)
    .values({
      memberId: params.memberId,
      chargeType: params.chargeType,
      description: params.description,
      referenceId: params.referenceId,
      durationMs: params.durationMs,
      unitRateCents: params.unitRateCents,
      amountCents: params.amountCents,
      occurredAt: params.occurredAt,
      billingMonth: monthKey(params.occurredAt),
    })
    .run();
}

// ---------- 事件驱动的费用记录 ----------

/** 工位签退 → DESK_USAGE（FIXED_DESK 已含在套餐内，¥0） */
export async function recordDeskUsage(params: {
  bookingId: string;
  memberId: string;
  checkOutTime: string;
}): Promise<void> {
  await insertUsage({
    memberId: params.memberId,
    chargeType: "DESK_USAGE",
    description: "固定工位使用费（含在套餐内）",
    referenceId: params.bookingId,
    durationMs: 0,
    unitRateCents: 0,
    amountCents: calculateDeskUsage(),
    occurredAt: new Date(params.checkOutTime),
  });
}

/** 会议室完成 → ROOM_USAGE + OVER_TIME_PENALTY */
export async function recordRoomUsage(params: {
  roomBookingId: string;
  memberId: string;
  roomId: string;
  bookedStartTime: string;
  bookedEndTime: string;
  actualStartTime: string;
  actualEndTime: string;
}): Promise<void> {
  const room = await db.select().from(meetingRooms).where(eq(meetingRooms.id, params.roomId)).get();
  const hourlyRateCents = room?.hourlyRateCents ?? 3000;

  const bookedStart = new Date(params.bookedStartTime);
  const bookedEnd = new Date(params.bookedEndTime);
  const actualEnd = new Date(params.actualEndTime);

  // ROOM_USAGE —— 按预订时长计费
  const roomAmount = calculateRoomUsage({
    bookedDurationMs: bookedEnd.getTime() - bookedStart.getTime(),
    hourlyRateCents,
  });
  await insertUsage({
    memberId: params.memberId,
    chargeType: "ROOM_USAGE",
    description: `会议室使用费 ¥${(hourlyRateCents / 100).toFixed(0)}/时`,
    referenceId: params.roomBookingId,
    durationMs: bookedEnd.getTime() - bookedStart.getTime(),
    unitRateCents: hourlyRateCents,
    amountCents: roomAmount,
    occurredAt: actualEnd,
  });

  // OVER_TIME_PENALTY —— 超时（扣 GracePeriod 15min）
  const overtimeAmount = calculateRoomOvertime({ bookedEndTime: bookedEnd, actualEndTime: actualEnd });
  if (overtimeAmount > 0) {
    await insertUsage({
      memberId: params.memberId,
      chargeType: "OVER_TIME_PENALTY",
      description: "会议室超时费（免罚 15 分钟）",
      referenceId: params.roomBookingId,
      durationMs: Math.max(0, actualEnd.getTime() - bookedEnd.getTime()),
      unitRateCents: 8000,
      amountCents: overtimeAmount,
      occurredAt: actualEnd,
    });
  }
}

/** 灵活区离场 → FLEX_USAGE（扣月度免费额度后按费率计费） */
export async function recordFlexUsage(params: {
  sessionId: string;
  memberId: string;
  checkOutTime: string;
  actualDurationMs: number;
}): Promise<void> {
  const sub = await db
    .select({ planType: subscriptions.planType, freeFlexHours: plans.freeFlexHours })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.memberId, params.memberId), eq(subscriptions.status, "ACTIVE")))
    .get();

  const planType = (sub?.planType ?? "VIRTUAL") as "FLEX_DESK" | "FIXED_DESK" | "PRIVATE_OFFICE" | "VIRTUAL";
  const freeFlexHoursMs = (sub?.freeFlexHours ?? 0) * HOUR_MS;

  // 本月已计入的灵活区时长（不含本次）—— 事件管线中免费额度扣减自洽
  const { start, end } = monthRange(monthKey(new Date(params.checkOutTime)));
  const prior = await db
    .select({ durationMs: usageRecords.durationMs })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.memberId, params.memberId),
        eq(usageRecords.chargeType, "FLEX_USAGE"),
        gte(usageRecords.occurredAt, start),
        lte(usageRecords.occurredAt, end)
      )
    )
    .all();
  const alreadyUsedMs = prior.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

  const amount = calculateFlexUsage({
    durationMs: params.actualDurationMs,
    planType,
    freeFlexHoursMs,
    alreadyUsedMsInMonth: alreadyUsedMs,
  });

  await insertUsage({
    memberId: params.memberId,
    chargeType: "FLEX_USAGE",
    description: `灵活区使用费 ¥${(amount / 100).toFixed(2)}`,
    referenceId: params.sessionId,
    durationMs: params.actualDurationMs,
    unitRateCents: 0, // 已摊入 amount，费率由 free 额度决定
    amountCents: amount,
    occurredAt: new Date(params.checkOutTime),
  });
}

/** 订阅变更 → MEMBERSHIP_FEE（套餐月费） */
export async function recordMembershipFee(params: {
  memberId: string;
  planType: string;
  monthlyFeeCents: number;
}): Promise<void> {
  const now = new Date();
  await insertUsage({
    memberId: params.memberId,
    chargeType: "MEMBERSHIP_FEE",
    description: `${params.planType} 套餐月费`,
    referenceId: `sub-${monthKey(now)}-${params.memberId}`,
    durationMs: 0,
    unitRateCents: 0,
    amountCents: params.monthlyFeeCents,
    occurredAt: now,
  });
}

// ---------- 月度出账 ----------

export type InvoiceView = Invoice;

/** 生成本月账单：先冲刷事件（自愈），再聚合 usage_records 出账 */
export async function generateMonthlyInvoice(
  memberId: string,
  billingMonth: string
): Promise<InvoiceView> {
  // 自愈：确保待处理事件（签退/完成/离场/订阅）已计入 usage_records
  await dispatchOutboxEvents();

  const existing = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.memberId, memberId), eq(invoices.billingMonth, billingMonth)))
    .get();
  if (existing) return existing as unknown as Invoice;

  const { start, end } = monthRange(billingMonth);
  const rows = await db
    .select()
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.memberId, memberId),
        eq(usageRecords.billingMonth, billingMonth)
      )
    )
    .all();

  let items = rows.map((r) => ({
    chargeType: r.chargeType as ChargeType,
    description: r.description,
    amountCents: r.amountCents,
  }));

  // 无会员费记录时，从当月生效订阅补入
  if (!items.some((i) => i.chargeType === "MEMBERSHIP_FEE")) {
    const sub = await db
      .select({ monthlyFeeCents: subscriptions.monthlyFeeCents, planType: subscriptions.planType })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.memberId, memberId),
          eq(subscriptions.status, "ACTIVE"),
          lte(subscriptions.startDate, end),
          gte(subscriptions.endDate, start)
        )
      )
      .get();
    if (sub) {
      items.push({
        chargeType: "MEMBERSHIP_FEE",
        description: `${sub.planType} 套餐月费`,
        amountCents: sub.monthlyFeeCents,
      });
    }
  }

  const member = await db.select().from(members).where(eq(members.id, memberId)).get();

  const lineItems: InvoiceLineItem[] = aggregateLineItems(items);

  // 灵活区月封顶（≤ 月费 120%）—— 聚合后仅对汇总行截断
  const flexLine = lineItems.find((l) => l.chargeType === "FLEX_USAGE");
  if (flexLine) {
    const membershipFee = lineItems.find((l) => l.chargeType === "MEMBERSHIP_FEE")?.amountCents ?? 0;
    flexLine.amountCents = applyFlexMonthlyCap({
      flexTotalCents: flexLine.amountCents,
      monthlyFeeCents: membershipFee,
    });
  }

  if (lineItems.length === 0) {
    throw new Error("当月暂无费用，无需出账");
  }

  const now = new Date();
  const invoice = buildInvoice({
    id: crypto.randomUUID(),
    memberId,
    billingMonth,
    lineItems,
    tier: member?.tier ?? "BASIC",
    dueDate: new Date(new Date(end).getTime() + 10 * 24 * HOUR_MS),
    createdAt: now,
  });

  // 发布 InvoiceIssued 事件（供 Notification 消费）—— 与账单写入同一事务，保证原子性
  const event = createEvent({
    eventType: "billing.invoice-issued",
    aggregateId: invoice.id,
    aggregateType: "Invoice",
    payload: {
      invoiceId: invoice.id,
      memberId: invoice.memberId,
      billingMonth: invoice.billingMonth,
      totalCents: invoice.totalCents,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(invoices)
      .values({
        id: invoice.id,
        memberId: invoice.memberId,
        billingMonth: invoice.billingMonth,
        totalCents: invoice.totalCents,
        discountRate: Math.round(invoice.discountRate * 100),
        discountAppliedCents: invoice.discountAppliedCents,
        paidAmountCents: 0,
        status: invoice.status,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
      })
      .run();
    await tx
      .insert(invoiceLineItems)
      .values(
        invoice.lineItems.map((l) => ({
          invoiceId: invoice.id,
          chargeType: l.chargeType,
          description: l.description,
          amountCents: l.amountCents,
        }))
      )
      .run();
    await appendOutboxEvents(tx, [event]);
  });

  return invoice;
}

// ---------- 支付（模拟） ----------

/** 模拟支付：PENDING/OVERDUE → PAID */
export async function processPayment(invoiceId: string, memberId: string): Promise<Invoice> {
  const row = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!row) throw new Error("账单不存在");
  if (row.memberId !== memberId) throw new Error("无权支付他人的账单");

  const paid = markInvoicePaid(row as unknown as Invoice, new Date());
  await db
    .update(invoices)
    .set({
      status: paid.status,
      paidAmountCents: paid.paidAmountCents,
      paidAt: paid.paidAt,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .run();
  return paid;
}

// ---------- 查询 ----------

/** 我的账单（含明细行） */
export async function listMyInvoices(memberId: string): Promise<InvoiceView[]> {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.memberId, memberId))
    .all();
  const items = await db.select().from(invoiceLineItems).all();
  return rows.map((r) => ({
    ...(r as unknown as Invoice),
    discountRate: (r.discountRate ?? 100) / 100,
    lineItems: items
      .filter((l) => l.invoiceId === r.id)
      .map((l) => ({
        chargeType: l.chargeType as ChargeType,
        description: l.description,
        amountCents: l.amountCents,
      })),
  }));
}

/** 待支付总额（PENDING + OVERDUE） */
export async function getOutstandingBalance(memberId: string): Promise<number> {
  const rows = await db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(
      and(
        eq(invoices.memberId, memberId),
        eq(invoices.status, "PENDING")
      )
    )
    .all();
  return rows.reduce((s, r) => s + r.totalCents, 0);
}
