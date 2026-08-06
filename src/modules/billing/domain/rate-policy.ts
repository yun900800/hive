/**
 * RatePolicy — 计费策略模式（纯函数）。
 * 不同套餐、不同会员等级对应不同费率。金额一律 integer cents。
 * 费率数据来自 design/pricing-scenarios-analysis.md §五 RatePolicy。
 */

/** 套餐类型（Billing 侧只关心费率档位，独立定义避免跨上下文耦合） */
export type BillingPlanType = "FLEX_DESK" | "FIXED_DESK" | "PRIVATE_OFFICE" | "VIRTUAL";

/** 灵活区费率（每小时的费率，cents）：FLEX < FIXED < VIRTUAL */
const FLEX_RATE_PER_HOUR_CENTS: Record<BillingPlanType, number> = {
  FLEX_DESK: 1500, // ¥15/h —— 已付月费，超额增量
  FIXED_DESK: 2000, // ¥20/h
  PRIVATE_OFFICE: 2000, // ¥20/h
  VIRTUAL: 3000, // ¥30/h —— 无月费补贴，按次收费
};

/** 超时费率（统一跨套餐，cents/小时）—— 约为正常会议室费率的 3 倍 */
export const OVERTIME_RATE_PER_HOUR_CENTS = 8000; // ¥80/h

/** 会员等级折扣率（应用于账单总价） */
export const TIER_DISCOUNT_RATE: Record<string, number> = {
  BASIC: 1.0,
  GOLD: 0.9, // 9折
  PLATINUM: 0.8, // 8折
};

/** 灵活区月封顶比例：月灵活区费用 ≤ 月费 × 120% */
export const FLEX_MONTHLY_CAP_RATE = 1.2;

/** 获取灵活区每小时费率（cents） */
export function flexRatePerHourCents(planType: BillingPlanType): number {
  return FLEX_RATE_PER_HOUR_CENTS[planType];
}

/** 会员等级折扣率（0~1），未知等级按无折扣处理 */
export function memberTierDiscountRate(tier: string): number {
  return TIER_DISCOUNT_RATE[tier] ?? 1.0;
}

/**
 * 计算灵活区单次会话使用费（扣月度免费额度后计费）。
 * @param durationMs 本次会话时长
 * @param planType 会员套餐
 * @param freeFlexHoursMs 套餐月度免费额度（毫秒）
 * @param alreadyUsedMsInMonth 本月已使用的灵活区时长（毫秒，不含本次）
 * @returns 本次应收金额（cents）；免费额度内返回 0
 */
export function calculateFlexUsage(params: {
  durationMs: number;
  planType: BillingPlanType;
  freeFlexHoursMs: number;
  alreadyUsedMsInMonth: number;
}): number {
  const { durationMs, planType, freeFlexHoursMs, alreadyUsedMsInMonth } = params;
  const remainingFreeMs = Math.max(0, freeFlexHoursMs - alreadyUsedMsInMonth);
  const chargeableMs = Math.max(0, durationMs - remainingFreeMs);
  const ratePerHourCents = flexRatePerHourCents(planType);
  // 按小时计费，保留两位小数（毫秒 → 小时 → 分）
  return Math.round((chargeableMs / 3_600_000) * ratePerHourCents);
}

/**
 * 计算会议室使用费：按预订时长计费（非实际使用），ceil 到整小时。
 * 业务逻辑：鼓励准时释放资源。
 */
export function calculateRoomUsage(params: {
  bookedDurationMs: number;
  hourlyRateCents: number;
}): number {
  const { bookedDurationMs, hourlyRateCents } = params;
  const bookedHours = Math.ceil(bookedDurationMs / 3_600_000);
  return bookedHours * hourlyRateCents;
}

/** 工位使用费：FIXED_DESK 自有工位已含在套餐内，恒为 ¥0 */
export function calculateDeskUsage(): number {
  return 0;
}

/**
 * 灵活区月封顶：本月灵活区费用合计不得超过月费 × 120%。
 * 防止费用失控（design 6.3 封顶规则）。
 */
export function applyFlexMonthlyCap(params: {
  flexTotalCents: number;
  monthlyFeeCents: number;
}): number {
  const { flexTotalCents, monthlyFeeCents } = params;
  const capCents = Math.round(monthlyFeeCents * FLEX_MONTHLY_CAP_RATE);
  return Math.min(flexTotalCents, capCents);
}
