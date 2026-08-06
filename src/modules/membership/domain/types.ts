/**
 * Membership bounded context — domain types.
 * Pure TypeScript, no framework dependencies. Mirrors `design/coworking-hive.cml`.
 */

/** MemberTier — 会员等级（影响折扣与权益） */
export const MEMBER_TIERS = ["BASIC", "SILVER", "GOLD", "PLATINUM"] as const;
export type MemberTier = (typeof MEMBER_TIERS)[number];

/** PlanType — 套餐类型 */
export const PLAN_TYPES = ["FLEX_DESK", "FIXED_DESK", "PRIVATE_OFFICE", "VIRTUAL"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/** SubscriptionStatus — 订阅状态 */
export const SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "CANCELLED",
  "EXPIRED",
  "SUSPENDED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** MemberId — 会员唯一标识 */
export type MemberId = string;

/** Email — 邮箱值对象（封装格式校验） */
export type Email = {
  address: string;
};

/** 会员领域实体 */
export type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: MemberTier;
  creditScore: number;
  createdAt: Date;
  updatedAt: Date;
};

/** 套餐目录实体（产品定义） */
export type Plan = {
  id: string;
  name: string;
  planType: PlanType;
  monthlyFeeCents: number; // 月费（分）
  freeFlexHours: number; // 灵活区免费额度（小时）
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** 订阅实体（会员的当前套餐） */
export type Subscription = {
  id: string;
  memberId: string;
  planId: string;
  planType: PlanType;
  monthlyFeeCents: number;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** 领域事件：会员注册 */
export type MemberRegisteredEvent = {
  memberId: string;
  name: string;
  email: string;
};

/** 领域事件：订阅变更 */
export type SubscriptionChangedEvent = {
  memberId: string;
  planType: PlanType;
  monthlyFeeCents: number;
};

/** 领域事件：会员升级 */
export type MemberUpgradedEvent = {
  memberId: string;
  newTier: MemberTier;
};
