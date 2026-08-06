"use server";

import { revalidatePath } from "next/cache";
import { getSessionMemberId } from "@/lib/auth-guards";
import { markAsRead, markAllRead } from "@/modules/notification/application/notification-app";

export type ActionState = { error?: string };

/** 标记单条已读 */
export async function markNotificationReadAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "缺少通知" };
  try {
    await markAsRead(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
  revalidatePath("/notifications");
  return {};
}

/** 全部标记已读 */
export async function markAllReadAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  await markAllRead(memberId);
  revalidatePath("/notifications");
  return {};
}
