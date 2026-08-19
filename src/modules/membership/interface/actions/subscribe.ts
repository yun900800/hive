"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionMemberId } from "@/lib/auth-guards";
import {
  subscribePlan,
  changeSubscription,
  cancelSubscription,
  getMember,
} from "@/modules/membership/application/membership-app";
import { dispatchOutboxEvents } from "@/shared/outbox";
import { ensureMonthlyInvoice } from "@/modules/billing/application/billing-app";
// 注册事件订阅者（Billing 记录会员费 / Notification / Access）
import "@/modules/billing/application/bootstrap";
import "@/modules/access/application/bootstrap";
import "@/modules/notification/application/bootstrap";

export type SubscribeState = {
  error?: string;
};

/** 订阅套餐（需要登录且绑定会员档案） */
export async function subscribePlanAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const memberId = await getSessionMemberId();
  const planId = String(formData.get("planId") ?? "");

  if (!memberId) {
    return { error: "请先登录会员账号" };
  }
  if (!planId) return { error: "请选择套餐" };

  try {
    await subscribePlan({ memberId, planId });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "订阅失败" };
  }
  await dispatchOutboxEvents();
  // 自动出账：订阅后立即生成当月账单
  try {
    await ensureMonthlyInvoice(memberId);
  } catch (e) {
    console.error("订阅后自动出账失败", e);
  }

  revalidatePath("/profile");
  revalidatePath("/subscription");
  revalidatePath("/billing");
  return { error: undefined };
}

/** 切换套餐（首次订阅 / 升级 / 降级 / 平级统一入口，实时生效） */
export async function changeSubscriptionAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const memberId = await getSessionMemberId();
  const planId = String(formData.get("planId") ?? "");

  if (!memberId) {
    return { error: "请先登录会员账号" };
  }
  if (!planId) return { error: "请选择套餐" };

  try {
    await changeSubscription({ memberId, planId });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "切换套餐失败" };
  }
  await dispatchOutboxEvents();
  // 自动出账：升级/降级后立即生成或追加当月账单
  try {
    await ensureMonthlyInvoice(memberId);
  } catch (e) {
    console.error("切换套餐后自动出账失败", e);
  }

  revalidatePath("/profile");
  revalidatePath("/subscription");
  revalidatePath("/billing");
  return { error: undefined };
}

/** 取消当前套餐（直接作为表单 action 使用） */
export async function cancelSubscriptionAction(): Promise<void> {
  const memberId = await getSessionMemberId();
  if (!memberId) return;

  try {
    await cancelSubscription(memberId);
  } catch (e) {
    console.error("取消订阅失败", e);
    return;
  }
  await dispatchOutboxEvents();

  revalidatePath("/profile");
  revalidatePath("/subscription");
}
