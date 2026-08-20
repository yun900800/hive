/**
 * Billing bounded context — domain types.
 * Pure TypeScript, no framework dependencies. Mirrors design/coworking-hive.cml Invoice aggregate.
 */

// ---------- 费用类型 ----------

/** ChargeType — 五种费用类型（收入来源） */
export const CHARGE_TYPES = [
  "MEMBERSHIP_FEE", // 会员月费 - 固定套餐费用
  "DESK_USAGE", // 固定工位使用费 - FIXED_DESK 含在套餐内
  "FLEX_USAGE", // 灵活区使用费 - 按实际在场时长计费
  "ROOM_USAGE", // 会议室使用费 - 按预订时长计费
  "OVER_TIME_PENALTY", // 超时罚金 - 会议室超时额外收费
] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

// ---------- 账单状态 ----------

/** InvoiceStatus — 账单状态 */
export const INVOICE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// ---------- 聚合实体 ----------

/** InvoiceLineItem — 账单明细行（值对象；每行对应一条消费明细 usage_record） */
export type InvoiceLineItem = {
  chargeType: ChargeType;
  description: string;
  amountCents: number;
  referenceId?: string | null; // 关联 usage_record.referenceId，用于追加未入账消费明细
  occurredAt?: Date | null; // 消费发生时间（从 usage_record 继承）
};

/** Invoice — 账单（聚合根，一个会员每月一张） */
export type Invoice = {
  id: string;
  memberId: string;
  billingMonth: string; // "YYYY-MM"
  totalCents: number; // 折扣后总额
  discountRate: number; // 1.0 / 0.9 / 0.8
  discountAppliedCents: number; // 折扣减免金额
  paidAmountCents: number;
  status: InvoiceStatus;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
  paidAt: Date | null;
};

/** UsageRecord — 使用记录（计费的原始素材，事件驱动写入） */
export type UsageRecord = {
  id: string;
  memberId: string;
  chargeType: ChargeType;
  description: string;
  referenceId: string; // 关联的 booking/session/subscription id
  durationMs: number;
  unitRateCents: number; // 单价（每小时的费率）
  amountCents: number;
  occurredAt: Date;
  billingMonth: string; // 冗余存储，便于月度聚合
};

// ---------- 会员等级 ----------

/** 会员等级（Billing 侧只关心折扣档位） */
export const BILLING_TIERS = ["BASIC", "GOLD", "PLATINUM"] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];
