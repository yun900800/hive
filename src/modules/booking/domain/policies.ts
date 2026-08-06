import type { DeskBooking } from "./types";

/**
 * BookingPolicies — 预订策略规则（纯函数）。
 * 来自 design/core-business.md：取消窗口 30 分钟；NoShow 判定 15 分钟。
 */

export const CANCEL_WINDOW_MINUTES = 30;
export const NO_SHOW_GRACE_MINUTES = 15;

export const CANCEL_WINDOW_MS = CANCEL_WINDOW_MINUTES * 60_000;
export const NO_SHOW_GRACE_MS = NO_SHOW_GRACE_MINUTES * 60_000;

/**
 * 取消窗口规则：预订开始前 30 分钟内不可免费取消。
 * 允许临界值（恰好开始前 30 分钟可取消，<=）。
 */
export function canCancel(
  booking: Pick<DeskBooking, "startTime">,
  cancelTime: Date
): boolean {
  return (
    cancelTime.getTime() <=
    booking.startTime.getTime() - CANCEL_WINDOW_MS
  );
}

/**
 * NoShow 规则：状态为 CONFIRMED 且已超过开始时刻 15 分钟未签到。
 * 临界值：恰好 15 分钟时尚未判定（严格大于）。
 */
export function isNoShow(
  booking: Pick<DeskBooking, "status" | "startTime">,
  now: Date
): boolean {
  return (
    booking.status === "CONFIRMED" &&
    now.getTime() > booking.startTime.getTime() + NO_SHOW_GRACE_MS
  );
}
