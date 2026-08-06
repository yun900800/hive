/**
 * Invoice 聚合 — 账单构造与状态流转（纯函数）。
 * 月度出账：聚合当月使用记录 → 生成 Invoice + 明细行 + 会员折扣。
 */

import type { Invoice, InvoiceLineItem, InvoiceStatus } from "./types";
import { memberTierDiscountRate } from "./rate-policy";

export type BuildInvoiceInput = {
  id: string;
  memberId: string;
  billingMonth: string;
  lineItems: InvoiceLineItem[];
  tier: string;
  dueDate: Date;
  createdAt: Date;
};

/** 按费用类型聚合明细行（合计金额） */
export function aggregateLineItems(
  items: Array<Pick<InvoiceLineItem, "chargeType" | "description" | "amountCents">>
): InvoiceLineItem[] {
  const grouped = new Map<string, InvoiceLineItem>();
  for (const item of items) {
    const existing = grouped.get(item.chargeType);
    if (existing) {
      existing.amountCents += item.amountCents;
    } else {
      grouped.set(item.chargeType, { ...item });
    }
  }
  return [...grouped.values()];
}

/** 计算账单总额与折扣减免 */
export function calculateInvoiceTotal(
  lineItems: InvoiceLineItem[],
  discountRate: number
): { totalBeforeDiscountCents: number; discountAppliedCents: number; totalCents: number } {
  const totalBeforeDiscountCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const totalCents = Math.round(totalBeforeDiscountCents * discountRate);
  return {
    totalBeforeDiscountCents,
    discountAppliedCents: totalBeforeDiscountCents - totalCents,
    totalCents,
  };
}

/** 构建新账单（PENDING）—— 应用会员等级折扣 */
export function buildInvoice(input: BuildInvoiceInput): Invoice {
  const discountRate = memberTierDiscountRate(input.tier);
  const { totalCents, discountAppliedCents } = calculateInvoiceTotal(input.lineItems, discountRate);
  return {
    id: input.id,
    memberId: input.memberId,
    billingMonth: input.billingMonth,
    totalCents,
    discountRate,
    discountAppliedCents,
    paidAmountCents: 0,
    status: "PENDING",
    dueDate: input.dueDate,
    lineItems: input.lineItems,
    createdAt: input.createdAt,
    paidAt: null,
  };
}

/** 支付账单（模拟）—— PENDING/OVERDUE → PAID */
export function markInvoicePaid(invoice: Invoice, paidAt: Date): Invoice {
  if (invoice.status !== "PENDING" && invoice.status !== "OVERDUE") {
    throw new Error(`账单状态 ${invoice.status} 不可支付`);
  }
  return {
    ...invoice,
    status: "PAID" as InvoiceStatus,
    paidAmountCents: invoice.totalCents,
    paidAt,
  };
}

/** 账单是否已付清 */
export function isInvoicePaid(invoice: Invoice): boolean {
  return invoice.status === "PAID";
}
