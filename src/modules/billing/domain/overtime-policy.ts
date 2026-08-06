/**
 * OvertimePolicy — 会议室超时计费策略（纯函数）。
 * 规则：超时费 =（实际结束 − 预订结束 − GracePeriod 15min）× 超时费率
 * 超时 ≤ 15 分钟 → 不收费。
 */

import { GRACE_PERIOD_MS } from "./grace-period";
import { OVERTIME_RATE_PER_HOUR_CENTS } from "./rate-policy";

/**
 * 计算会议室超时费（cents）。
 * @param bookedEndTime 预订结束时间
 * @param actualEndTime 实际使用结束时间
 * @returns 超时费用（cents），免罚期内返回 0
 */
export function calculateRoomOvertime(params: {
  bookedEndTime: Date;
  actualEndTime: Date;
  overtimeRatePerHourCents?: number;
}): number {
  const { bookedEndTime, actualEndTime } = params;
  const overtimeRatePerHourCents =
    params.overtimeRatePerHourCents ?? OVERTIME_RATE_PER_HOUR_CENTS;

  const overtimeMs = actualEndTime.getTime() - bookedEndTime.getTime();
  if (overtimeMs <= 0) return 0;

  const chargeableMs = Math.max(0, overtimeMs - GRACE_PERIOD_MS);
  if (chargeableMs === 0) return 0;

  // 按小数小时计费：30min 超时 = 0.5h × ¥80 = ¥40
  return Math.round((chargeableMs / 3_600_000) * overtimeRatePerHourCents);
}

/** 判断是否存在需要计费的超时（超出免罚期） */
export function hasChargeableOvertime(params: {
  bookedEndTime: Date;
  actualEndTime: Date;
}): boolean {
  const { bookedEndTime, actualEndTime } = params;
  return actualEndTime.getTime() - bookedEndTime.getTime() > GRACE_PERIOD_MS;
}
