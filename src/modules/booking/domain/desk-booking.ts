import type { DeskBooking, DeskBookingStatus } from "./types";
import { AUTO_CHECK_OUT_GRACE_MS, canCancel, isNoShow } from "./policies";

/**
 * DeskBooking state machine — 工位预订生命周期（纯函数）。
 *
 *   PENDING ──确认──► CONFIRMED ──签到──► CHECKED_IN ──签退──► CHECKED_OUT
 *                        │  ▲                    │
 *                        │  └── 30 分钟前免费取消 ┘
 *                        ▼
 *              CANCELLED / NO_SHOW
 *
 * 业务不变量（design/core-business.md）：
 * - 已确认的预订才能签到
 * - 已签到的才能签退
 * - 取消只能在预订开始 30 分钟前
 * - 签到后 15 分钟未到 → NO_SHOW
 */

export type TransitionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type BookingPatch = Partial<DeskBooking>;

function result(value: DeskBooking): TransitionResult<DeskBooking> {
  return { ok: true, value };
}

function fail(msg: string): TransitionResult<DeskBooking> {
  return { ok: false, error: msg };
}

function patch(booking: DeskBooking, changes: BookingPatch, now: Date): DeskBooking {
  return { ...booking, ...changes, updatedAt: now };
}

/** PENDING → CONFIRMED（创建后系统确认，锁定工位） */
export function confirmBooking(
  booking: DeskBooking,
  now: Date
): TransitionResult<DeskBooking> {
  if (booking.status !== "PENDING") {
    return fail(`无法确认：当前状态 ${booking.status}（仅 PENDING 可确认）`);
  }
  return result(patch(booking, { status: "CONFIRMED" }, now));
}

/** CONFIRMED → CHECKED_IN（扫码签到） */
export function checkInDeskBooking(
  booking: DeskBooking,
  now: Date
): TransitionResult<DeskBooking> {
  if (booking.status !== "CONFIRMED") {
    return fail(`无法签到：当前状态 ${booking.status}（仅 CONFIRMED 可签到）`);
  }
  return result(patch(booking, { status: "CHECKED_IN", checkedInAt: now }, now));
}

/** CHECKED_IN → CHECKED_OUT（离场签退，释放工位） */
export function checkOutDeskBooking(
  booking: DeskBooking,
  now: Date
): TransitionResult<DeskBooking> {
  if (booking.status !== "CHECKED_IN") {
    return fail(`无法签退：当前状态 ${booking.status}（仅 CHECKED_IN 可签退）`);
  }
  return result(patch(booking, { status: "CHECKED_OUT", checkedOutAt: now }, now));
}

/**
 * CHECKED_IN → CHECKED_OUT（到期自动签退，由定时巡检调用）。
 *
 * 只在「预订结束 + 宽限期」之后触发；checkedOutAt 记为预订结束时间，
 * 而不是巡检任务实际运行时间 —— 任务延迟 5 分钟不会污染使用时长。
 */
export function autoCheckOut(
  booking: DeskBooking,
  now: Date,
  graceMs = AUTO_CHECK_OUT_GRACE_MS
): TransitionResult<DeskBooking> {
  if (booking.status !== "CHECKED_IN") {
    return fail(`无法自动签退：当前状态 ${booking.status}（仅 CHECKED_IN 可签退）`);
  }
  if (now.getTime() <= booking.endTime.getTime() + graceMs) {
    return fail(`尚未超过自动签退时间（结束 + ${Math.round(graceMs / 60_000)} 分钟）`);
  }
  return result(
    patch(booking, { status: "CHECKED_OUT", checkedOutAt: booking.endTime }, now)
  );
}

/** CONFIRMED → CANCELLED（仅预订开始 30 分钟前可免费取消） */
export function cancelDeskBooking(
  booking: DeskBooking,
  cancelTime: Date
): TransitionResult<DeskBooking> {
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    return fail(`无法取消：当前状态 ${booking.status}`);
  }
  if (!canCancel(booking, cancelTime)) {
    return fail(`已超过免费取消窗口（开始前 ${30} 分钟内不可取消）`);
  }
  return result(patch(booking, { status: "CANCELLED", cancelledAt: cancelTime }, cancelTime));
}

/** CONFIRMED → NO_SHOW（签到后 15 分钟未到，自动释放） */
export function markDeskNoShow(
  booking: DeskBooking,
  now: Date
): TransitionResult<DeskBooking> {
  if (booking.status !== "CONFIRMED") {
    return fail(`无法标记 NoShow：当前状态 ${booking.status}（仅 CONFIRMED 可判定）`);
  }
  if (!isNoShow(booking, now)) {
    return fail(`尚未超过 NoShow 判定时间（开始后 ${15} 分钟）`);
  }
  return result(patch(booking, { status: "NO_SHOW" }, now));
}

export type { DeskBookingStatus };
