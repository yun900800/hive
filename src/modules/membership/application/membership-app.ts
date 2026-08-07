import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  members,
  users,
  plans,
  subscriptions,
  outboxEvents,
} from "@/lib/db/schema";
import { createEvent } from "@/shared/events";
import type { MemberTier, PlanType, SubscriptionStatus } from "../domain/types";

/**
 * MembershipApplicationService — 会员注册、套餐订阅等用例编排。
 * 领域规则调用 domain/ 层纯函数；跨聚合协调在本层完成。
 */

export type RegisterMemberInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

export type RegisterMemberResult = {
  memberId: string;
  userId: string;
};

export async function registerMember(
  input: RegisterMemberInput
): Promise<RegisterMemberResult> {
  // 幂等保护：邮箱已存在则报错（注册页面已有前端校验）
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .get();
  if (existing) {
    throw new Error("该邮箱已注册");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const result = await db.transaction(async (tx) => {
    const member = await tx
      .insert(members)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone ?? "",
        tier: "BASIC",
        creditScore: 100,
      })
      .returning({ id: members.id })
      .get();

    const user = await tx
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: "MEMBER",
        memberId: member.id,
      })
      .returning({ id: users.id })
      .get();

    // 事务内写入 Outbox：MemberRegistered 事件
    const event = createEvent({
      eventType: "membership.member-registered",
      aggregateId: member.id,
      aggregateType: "Member",
      payload: {
        memberId: member.id,
        name: input.name,
        email: input.email,
      },
    });
    await tx
      .insert(outboxEvents)
      .values({
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
      })
      .run();

    return { memberId: member.id, userId: user.id };
  });

  return result;
}

export type SubscribePlanInput = {
  memberId: string;
  planId: string;
};

export type SubscriptionView = {
  id: string;
  planId: string;
  planType: PlanType;
  monthlyFeeCents: number;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
};

/** 订阅套餐：会员同时只能有一个生效套餐（业务不变量） */
export async function subscribePlan(
  input: SubscribePlanInput
): Promise<SubscriptionView> {
  const plan = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId))
    .get();
  if (!plan) throw new Error("套餐不存在");

  const activeSub = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.memberId, input.memberId),
        eq(subscriptions.status, "ACTIVE")
      )
    )
    .get();
  if (activeSub) {
    throw new Error("已有生效套餐，请先取消当前套餐");
  }

  const now = new Date();
  const start = now;
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );

  const result = await db.transaction(async (tx) => {
    const sub = await tx
      .insert(subscriptions)
      .values({
        memberId: input.memberId,
        planId: plan.id,
        planType: plan.planType,
        monthlyFeeCents: plan.monthlyFeeCents,
        startDate: start,
        endDate: end,
        status: "ACTIVE",
      })
      .returning()
      .get();

    const event = createEvent({
      eventType: "membership.subscription-changed",
      aggregateId: sub.id,
      aggregateType: "Subscription",
      payload: {
        memberId: input.memberId,
        planType: plan.planType,
        monthlyFeeCents: plan.monthlyFeeCents,
      },
    });
    await tx
      .insert(outboxEvents)
      .values({
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
      })
      .run();

    return sub;
  });

  return result;
}

/** 取消当前生效套餐 */
export async function cancelSubscription(memberId: string): Promise<void> {
  const activeSub = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.memberId, memberId),
        eq(subscriptions.status, "ACTIVE")
      )
    )
    .get();
  if (!activeSub) throw new Error("没有生效中的套餐");

  const event = createEvent({
    eventType: "membership.subscription-cancelled",
    aggregateId: activeSub.id,
    aggregateType: "Subscription",
    payload: {
      memberId,
      planType: activeSub.planType,
      cancelledAt: new Date().toISOString(),
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(subscriptions.id, activeSub.id))
      .run();
    await tx
      .insert(outboxEvents)
      .values({
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
      })
      .run();
  });
}

/** 查询会员当前生效套餐 */
export async function getActiveSubscription(
  memberId: string
): Promise<SubscriptionView | null> {
  const sub = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.memberId, memberId),
        eq(subscriptions.status, "ACTIVE")
      )
    )
    .get();
  return sub ?? null;
}

/** 查询会员资料 */
export async function getMember(memberId: string) {
  return db
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .get();
}

/** 会员等级折扣（领域层：tier.ts）—— 供 UI 展示 */
export type { MemberTier };

/** 查询所有可用套餐 */
export async function listPlans() {
  return db.select().from(plans).where(eq(plans.isActive, true)).all();
}
