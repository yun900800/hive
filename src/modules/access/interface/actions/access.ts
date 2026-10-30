"use server";

import { revalidatePath } from "next/cache";
import { getSessionMemberId } from "@/lib/auth-guards";
import { formatDateTime } from "@/lib/format";
import { parseBusinessDateTime } from "@/shared/clock";
import * as access from "@/modules/access/application/access-app";

export type ActionState = { error?: string; success?: string };

/** 模拟扫码：通行证编码 + 闸机 + 方向（可选模拟时间） */
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

  // 模拟时间：datetime-local 不带时区，按北京时间解释；留空＝当前时间
  const rawAccessTime = String(formData.get("accessTime") ?? "").trim();
  let accessTime = new Date();
  if (rawAccessTime) {
    const parsed = parseBusinessDateTime(rawAccessTime);
    if (!parsed) return { error: "模拟时间格式不正确" };
    accessTime = parsed;
  }

  const result = await access.scan(passCode, gateName, direction, accessTime);
  revalidatePath("/access");

  if (!result.granted) {
    const pass = result.gatePass;
    switch (result.result) {
      case "DENIED_NOT_STARTED":
        return {
          error: pass
            ? `通行被拒：未到生效时间，${formatDateTime(pass.validFrom)} 起可通行`
            : "通行被拒：未到生效时间",
        };
      case "DENIED_EXPIRED":
        return {
          error: pass
            ? `通行被拒：通行证已过期（截止 ${formatDateTime(pass.validTo)}）`
            : "通行被拒：通行证已过期",
        };
      case "DENIED_REVOKED":
        return { error: "通行被拒：通行证已撤销（预订可能已取消）" };
      case "DENIED_NO_BOOKING":
        return { error: "通行被拒：通行证状态不可用（可能已使用）" };
      default:
        return { error: "通行被拒：通行证编码无效" };
    }
  }

  const verb = direction === "ENTRY" ? "进入" : "离开";
  return { success: `${verb}成功（模拟时间 ${formatDateTime(accessTime)}），欢迎使用蜂巢！` };
}
