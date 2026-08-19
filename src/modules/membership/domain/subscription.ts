import type { SubscriptionStatus } from "./types";

/**
 * Subscription domain rules — 订阅状态与有效期规则。
 * 来自 core-business.md 与 pricing-scenarios-analysis.md。
 */

/** 订阅是否生效（只有 ACTIVE 才可使用权益） */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "ACTIVE";
}

/** 按天折算月费：月中开通只按剩余天数比例计费（向上取整到分） */
export function prorateMonthlyFee(
  monthlyFeeCents: number,
  startDate: Date,
  billingMonth: Date
): number {
  const monthStart = new Date(
    billingMonth.getFullYear(),
    billingMonth.getMonth(),
    1
  );
  const nextMonthStart = new Date(
    billingMonth.getFullYear(),
    billingMonth.getMonth() + 1,
    1
  );
  const daysInMonth = Math.round(
    (nextMonthStart.getTime() - monthStart.getTime()) / 86_400_000
  );

  const clampedStart =
    startDate.getTime() < monthStart.getTime()
      ? monthStart
      : startDate.getTime() > nextMonthStart.getTime()
        ? nextMonthStart
        : startDate;

  const remainingDays = Math.max(
    0,
    Math.round(
      (nextMonthStart.getTime() - clampedStart.getTime()) / 86_400_000
    )
  );

  return Math.round((monthlyFeeCents * remainingDays) / daysInMonth);
}

/** 套餐切换差价：新月费 − 旧月费（全额，不按剩余天数折算） */
export function calculatePlanDiff(oldFeeCents: number, newFeeCents: number): number {
  return newFeeCents - oldFeeCents;
}

/** 套餐切换方向：价格更高 → 升级，更低 → 降级，相等 → 平级 */
export function classifyPlanChange(
  oldFeeCents: number,
  newFeeCents: number
): "UPGRADE" | "DOWNGRADE" | "SAME" {
  if (newFeeCents > oldFeeCents) return "UPGRADE";
  if (newFeeCents < oldFeeCents) return "DOWNGRADE";
  return "SAME";
}
