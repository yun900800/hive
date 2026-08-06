"use server";

import { revalidatePath } from "next/cache";
import { getSessionMemberId } from "@/lib/auth-guards";
import * as billing from "@/modules/billing/application/billing-app";
import "@/modules/billing/application/bootstrap";

export type ActionState = { error?: string };

/** 生成本月账单（同时冲刷待处理事件） */
export async function generateMyInvoiceAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录会员账号" };

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  try {
    await billing.generateMonthlyInvoice(memberId, month);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "出账失败" };
  }
  revalidatePath("/billing");
  return {};
}

/** 模拟支付账单 */
export async function payInvoiceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录会员账号" };

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { error: "缺少账单" };

  try {
    await billing.processPayment(invoiceId, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "支付失败" };
  }
  revalidatePath("/billing");
  return {};
}
