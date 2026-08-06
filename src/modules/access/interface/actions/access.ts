"use server";

import { revalidatePath } from "next/cache";
import { getSessionMemberId } from "@/lib/auth-guards";
import * as access from "@/modules/access/application/access-app";

export type ActionState = { error?: string; success?: string };

/** 模拟扫码：通行证编码 + 闸机 + 方向 */
export async function scanAccessAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录会员账号" };

  const passCode = String(formData.get("passCode") ?? "").trim();
  const gateName = String(formData.get("gateName") ?? "").trim() || "入口闸机";
  const direction = String(formData.get("direction") ?? "ENTRY") === "EXIT" ? "EXIT" : "ENTRY";
  if (!passCode) return { error: "请输入通行证编码" };

  const result = await access.scan(passCode, gateName, direction);
  if (!result.granted) {
    return { error: `通行被拒：${result.result}` };
  }
  revalidatePath("/access");
  return { success: `${direction === "ENTRY" ? "进入" : "离开"}成功，欢迎使用蜂巢！` };
}
