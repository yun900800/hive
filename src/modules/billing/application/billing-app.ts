import { eq, and, or, gte, lte, inArray } from "drizzle-orm";
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

/** 会议室开始使用 → ROOM_USAGE（按预定时长计费，资源已锁定不退差额） */
export async function recordRoomUsage(params: {
  roomBookingId: string;
  memberId: string;
  roomId: string;
  bookedStartTime: string;
  bookedEndTime: string;
  actualStartTime: string;
}): Promise<void> {
  const room = await db.select().from(meetingRooms).where(eq(meetingRooms.id, params.roomId)).get();
  const hourlyRateCents = room?.hourlyRateCents ?? 3000;

  const bookedStart = new Date(params.bookedStartTime);
  const bookedEnd = new Date(params.bookedEndTime);

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
    occurredAt: new Date(params.actualStartTime),
  });
}

/** 会议室完成使用 → OVER_TIME_PENALTY（超时，扣 GracePeriod 15min） */
export async function recordRoomOvertime(params: {
  roomBookingId: string;
  memberId: string;
  bookedEndTime: string;
  actualEndTime: string;
}): Promise<void> {
  const bookedEnd = new Date(params.bookedEndTime);
  const actualEnd = new Date(params.actualEndTime);

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

/** 切换套餐时补记当月基础月费（按旧价；当月已付不退）。当月已有 MEMBERSHIP_FEE 则不重复记录。 */
export async function recordBaseMembershipFee(params: {
  memberId: string;
  planType: string;
  monthlyFeeCents: number;
}): Promise<void> {
  const now = new Date();
  const month = monthKey(now);
  const existing = await db
    .select({ id: usageRecords.id })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.memberId, params.memberId),
        eq(usageRecords.chargeType, "MEMBERSHIP_FEE"),
        eq(usageRecords.billingMonth, month)
      )
    )
    .get();
  if (existing) return;
  await insertUsage({
    memberId: params.memberId,
    chargeType: "MEMBERSHIP_FEE",
    description: `${params.planType} 套餐月费`,
    referenceId: `sub-base-${month}-${params.memberId}`,
    durationMs: 0,
    unitRateCents: 0,
    amountCents: params.monthlyFeeCents,
    occurredAt: now,
  });
}

/** 升级差价 → MEMBERSHIP_FEE（referenceId 用新订阅 id，天然唯一且幂等） */
export async function recordUpgradeFee(params: {
  memberId: string;
  planType: string;
  diffCents: number;
  subId: string;
}): Promise<void> {
  const now = new Date();
  await insertUsage({
    memberId: params.memberId,
    chargeType: "MEMBERSHIP_FEE",
    description: `${params.planType} 套餐升级差价`,
    referenceId: `sub-upgrade-${params.subId}`,
    durationMs: 0,
    unitRateCents: 0,
    amountCents: params.diffCents,
    occurredAt: now,
  });
}

// ---------- 月度出账 ----------

export type InvoiceView = Invoice;

/**
 * 生成本月账单：先冲刷事件（自愈），再聚合 usage_records 出账。
 * 明细行 = 每条消费明细一行（不聚合）。
 * 已有未支付账单（PENDING/OVERDUE）→ 追加未入账消费明细（如升级差价）；
 * 无未支付账单（含已支付账单）→ 生成新账单，只包含未入账消费明细。
 */
export async function generateMonthlyInvoice(
  memberId: string,
  billingMonth: string
): Promise<InvoiceView> {
  // 自愈：确保待处理事件（签退/完成/离场/订阅）已计入 usage_records
  await dispatchOutboxEvents();

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

  // 当月所有账单 + 已入账消费明细的 referenceId
  const monthInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.memberId, memberId), eq(invoices.billingMonth, billingMonth)))
    .all();
  const allLineItems =
    monthInvoices.length > 0
      ? await db
          .select()
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, monthInvoices.map((i) => i.id)))
          .all()
      : [];
  const invoicedRefIds = new Set(allLineItems.map((l) => l.referenceId).filter(Boolean));

  let result: InvoiceView;

  // 未支付账单（PENDING/OVERDUE）→ 追加未入账消费明细
  const pendingInvoice = monthInvoices.find(
    (i) => i.status === "PENDING" || i.status === "OVERDUE"
  );
  if (pendingInvoice) {
    const existingItems = allLineItems.filter((l) => l.invoiceId === pendingInvoice.id);
    // 历史数据兜底：referenceId 为 null 的旧明细行无法精确匹配，
    // 只追加账单生成后新发生的消费明细（occurredAt 晚于账单创建时间），避免重复入账
    const invoiceCreatedAtMs = pendingInvoice.createdAt?.getTime() ?? 0;
    const pending = rows.filter((r) => {
      if (invoicedRefIds.has(r.referenceId)) return false;
      return (r.occurredAt?.getTime() ?? 0) > invoiceCreatedAtMs;
    });
    if (pending.length === 0) {
      result = {
        ...(pendingInvoice as unknown as Invoice),
        lineItems: existingItems.map((l) => ({
          chargeType: l.chargeType as ChargeType,
          description: l.description,
          amountCents: l.amountCents,
          referenceId: l.referenceId,
          occurredAt: l.occurredAt,
        })),
      };
    } else {
      const newItems = pending.map((r) => ({
        chargeType: r.chargeType as ChargeType,
        description: r.description,
        amountCents: r.amountCents,
        referenceId: r.referenceId,
        occurredAt: r.occurredAt,
      }));

      // 按原折扣率更新总额：totalBefore = totalCents + discountAppliedCents（精确反推）
      const rate = (pendingInvoice.discountRate ?? 100) / 100;
      const totalBefore = pendingInvoice.totalCents + pendingInvoice.discountAppliedCents;
      const newTotalBefore = totalBefore + newItems.reduce((s, i) => s + i.amountCents, 0);
      const newTotalCents = Math.round(newTotalBefore * rate);
      const newDiscountApplied = newTotalBefore - newTotalCents;

      // 追加也发布 InvoiceIssued 事件（供 Notification 消费）—— 与追加写入同一事务
      const event = createEvent({
        eventType: "billing.invoice-issued",
        aggregateId: pendingInvoice.id,
        aggregateType: "Invoice",
        payload: {
          invoiceId: pendingInvoice.id,
          memberId: pendingInvoice.memberId,
          billingMonth: pendingInvoice.billingMonth,
          totalCents: newTotalCents,
        },
      });

      await db.transaction(async (tx) => {
        await tx
          .update(invoices)
          .set({
            totalCents: newTotalCents,
            discountAppliedCents: newDiscountApplied,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, pendingInvoice.id))
          .run();
        await tx
          .insert(invoiceLineItems)
          .values(
            newItems.map((l) => ({
              invoiceId: pendingInvoice.id,
              chargeType: l.chargeType,
              description: l.description,
              amountCents: l.amountCents,
              referenceId: l.referenceId,
              occurredAt: l.occurredAt,
            }))
          )
          .run();
        await appendOutboxEvents(tx, [event]);
      });

      result = {
        ...(pendingInvoice as unknown as Invoice),
        totalCents: newTotalCents,
        discountAppliedCents: newDiscountApplied,
        lineItems: [...existingItems, ...newItems].map((l) => ({
          chargeType: l.chargeType as ChargeType,
          description: l.description,
          amountCents: l.amountCents,
          referenceId: l.referenceId,
          occurredAt: l.occurredAt,
        })),
      };
    }
  } else {
    // 无未支付账单：生成新账单，只包含未入账消费明细（已支付账单已入账的跳过）
    let items = rows
      .filter((r) => !invoicedRefIds.has(r.referenceId))
      .map((r) => ({
        chargeType: r.chargeType as ChargeType,
        description: r.description,
        amountCents: r.amountCents,
        referenceId: r.referenceId,
        occurredAt: r.occurredAt,
      }));

    // 无会员费记录时，从当月生效订阅补入（未入账才补）
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
        const syntheticRef = `sub-monthly-${billingMonth}-${memberId}`;
        if (!invoicedRefIds.has(syntheticRef)) {
          items.push({
            chargeType: "MEMBERSHIP_FEE",
            description: `${sub.planType} 套餐月费`,
            amountCents: sub.monthlyFeeCents,
            referenceId: syntheticRef,
            occurredAt: start,
          });
        }
      }
    }

    const member = await db.select().from(members).where(eq(members.id, memberId)).get();

    // 灵活区月封顶（≤ 月费 120%）—— 按比例分摊到每条 FLEX_USAGE 明细
    const flexRows = items.filter((i) => i.chargeType === "FLEX_USAGE");
    if (flexRows.length > 0) {
      const membershipFee = items.find((i) => i.chargeType === "MEMBERSHIP_FEE")?.amountCents ?? 0;
      const flexTotal = flexRows.reduce((s, i) => s + i.amountCents, 0);
      const cappedTotal = applyFlexMonthlyCap({
        flexTotalCents: flexTotal,
        monthlyFeeCents: membershipFee,
      });
      if (cappedTotal < flexTotal) {
        let assigned = 0;
        flexRows.forEach((row, idx) => {
          if (idx === flexRows.length - 1) {
            row.amountCents = cappedTotal - assigned; // 最后一条补舍入差
          } else {
            row.amountCents = Math.round((row.amountCents * cappedTotal) / flexTotal);
            assigned += row.amountCents;
          }
        });
      }
    }

    const lineItems: InvoiceLineItem[] = items;

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
            referenceId: l.referenceId,
            occurredAt: l.occurredAt,
          }))
        )
        .run();
      await appendOutboxEvents(tx, [event]);
    });

    result = invoice;
  }

  // 冲刷本次出账新发布的事件（invoice-issued → 通知），避免事件滞留 PENDING
  await dispatchOutboxEvents();
  return result;
}

/** 订阅/升级/降级后自动出账：冲刷事件 → 生成或追加当月账单 */
export async function ensureMonthlyInvoice(memberId: string): Promise<InvoiceView> {
  const now = new Date();
  const month = monthKey(now);
  return generateMonthlyInvoice(memberId, month);
}

/**
 * 惰性出账兜底：当月无账单且订阅 ACTIVE 时自动生成。
 * 用于无 Cron 环境（Vercel Hobby）——用户访问账单页时保证能看到当月账单。
 * 幂等：当月已有账单（含已支付）则跳过；无费用时静默。
 */
export async function ensureMonthlyInvoiceIfNeeded(memberId: string): Promise<void> {
  const month = monthKey(new Date());

  const sub = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.memberId, memberId), eq(subscriptions.status, "ACTIVE")))
    .get();
  if (!sub) return;

  // 始终调用 generateMonthlyInvoice —— 它内部幂等：
  // - 已有账单 → 追加未入账的消费明细
  // - 无账单 → 生成新账单
  // - 无新费用 → 静默返回
  try {
    await generateMonthlyInvoice(memberId, month);
  } catch {
    // 当月暂无费用等 —— 静默，不阻塞页面
  }
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
        referenceId: l.referenceId,
        occurredAt: l.occurredAt,
      })),
  }));
}

/** 待支付总额（PENDING + OVERDUE 未支付账单） */
export async function getOutstandingBalance(memberId: string): Promise<number> {
  const rows = await db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(
      and(
        eq(invoices.memberId, memberId),
        or(eq(invoices.status, "PENDING"), eq(invoices.status, "OVERDUE"))
      )
    )
    .all();
  return rows.reduce((s, r) => s + r.totalCents, 0);
}

/** 已支付总额（PAID 账单） */
export async function getPaidTotal(memberId: string): Promise<number> {
  const rows = await db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(and(eq(invoices.memberId, memberId), eq(invoices.status, "PAID")))
    .all();
  return rows.reduce((s, r) => s + r.totalCents, 0);
}
