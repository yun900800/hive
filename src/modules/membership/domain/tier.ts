import type { MemberTier } from "./types";

/**
 * Member tier policies — 会员等级折扣。
 * 来自 pricing-scenarios-analysis.md：GOLD 9 折、PLATINUM 8 折。
 */

export const TIER_DISCOUNTS: Record<MemberTier, number> = {
  BASIC: 1,
  SILVER: 0.95, // 银卡（累计消费满 ¥1000）
  GOLD: 0.9, // 金卡（累计消费满 ¥5000）
  PLATINUM: 0.8, // 铂金（累计消费满 ¥20000 或企业会员）
};

export function getTierDiscount(tier: MemberTier): number {
  return TIER_DISCOUNTS[tier];
}

/** 应用会员等级折扣后的金额（分）：金额 = 原价 × 折扣 */
export function applyTierDiscount(amountCents: number, tier: MemberTier): number {
  return Math.round(amountCents * getTierDiscount(tier));
}
