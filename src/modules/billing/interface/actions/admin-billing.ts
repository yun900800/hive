"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { processPayment, generateMonthlyInvoice } from "@/modules/billing/application/billing-app";
import { dispatchOutboxEvents } from "@/shared/outbox";
import "@/modules/billing/application/bootstrap";
import "@/modules/notification/application/bootstrap";

export type ActionState = { error?: string; success?: string };

/** 管理员：手动出账（按月份） */
export async function adminGenerateInvoiceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();
    const memberId = String(formData.get("memberId") ?? "");
    const month = String(formData.get("month") ?? "");
    if (!memberId || !/^\d{4}-\d{2}$/.test(month)) return { error: "参数错误" };
    await generateMonthlyInvoice(memberId, month);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "出账失败" };
  }
  revalidatePath("/admin/billing");
  return { success: "出账成功" };
}

/** 管理员：模拟支付 */
export async function adminPayInvoiceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const memberId = String(formData.get("memberId") ?? "");
    if (!invoiceId || !memberId) return { error: "参数错误" };
    await processPayment(invoiceId, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "支付失败" };
  }
  revalidatePath("/admin/billing");
  return { success: "已标记支付" };
}

/** 管理员：冲刷 Outbox 事件 */
export async function adminDispatchOutboxAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();
    const result = await dispatchOutboxEvents();
    return { success: `已处理 ${result.processed} 个事件（跳过 ${result.skipped}，失败 ${result.failed}）` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "分发失败" };
  }
}
