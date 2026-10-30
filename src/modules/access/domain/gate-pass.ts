/**
 * GatePass 领域服务（纯函数）—— 通行校验与状态流转。
 * 模拟扫码：校验通行证是否可在指定时刻通行。
 */

import type { GatePass, AccessResult, GatePassStatus } from "./types";

/** 校验通行证在指定时刻是否可通行 */
export function canGrantAccess(
  pass: Pick<GatePass, "status" | "validFrom" | "validTo">,
  accessTime: Date
): { granted: boolean; result: AccessResult } {
  if (pass.status === "REVOKED") {
    return { granted: false, result: "DENIED_REVOKED" };
  }
  if (pass.status === "EXPIRED") {
    return { granted: false, result: "DENIED_EXPIRED" };
  }
  if (pass.status !== "ACTIVE") {
    return { granted: false, result: "DENIED_NO_BOOKING" };
  }
  const t = accessTime.getTime();
  // 「未到生效时间」与「已过期」必须区分：前者是来得太早，后者是错过时段。
  if (t < pass.validFrom.getTime()) {
    return { granted: false, result: "DENIED_NOT_STARTED" };
  }
  if (t > pass.validTo.getTime()) {
    return { granted: false, result: "DENIED_EXPIRED" };
  }
  return { granted: true, result: "GRANTED" };
}

/** 通行成功后标记为 USED（进入）或保持（退出复用同一通行证记录日志） */
export function markPassUsed(pass: GatePass): GatePass {
  return { ...pass, status: "USED" as GatePassStatus };
}

/** 撤销通行证（预订取消时触发） */
export function revokePass(pass: GatePass): GatePass {
  if (pass.status === "REVOKED") return pass;
  return { ...pass, status: "REVOKED" as GatePassStatus };
}

/** 判断通行证是否过期（授权时段已过且未使用） */
export function isExpired(pass: GatePass, now: Date): boolean {
  return pass.status === "ACTIVE" && now.getTime() > pass.validTo.getTime();
}

/** 生成通行证编码（模拟：GP-{shortUuid}） */
export function generatePassCode(bookingId: string): string {
  return `GP-${bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
