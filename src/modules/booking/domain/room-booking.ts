import type { RoomBooking, RoomBookingStatus } from "./types";
import { AUTO_COMPLETE_GRACE_MS } from "./policies";

/**
 * MeetingRoomBooking state machine — 会议室预订生命周期（纯函数）。
 *
 *   PENDING ──确认──► CONFIRMED ──开始──► IN_PROGRESS ──完成──► COMPLETED
 *     │                 │
 *     └────── 取消 ─────┘  （PENDING / CONFIRMED 可取消）
 */

export type TransitionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type BookingPatch = Partial<RoomBooking>;

function result(value: RoomBooking): TransitionResult<RoomBooking> {
  return { ok: true, value };
}

function fail(msg: string): TransitionResult<RoomBooking> {
  return { ok: false, error: msg };
}

function patch(booking: RoomBooking, changes: BookingPatch, now: Date): RoomBooking {
  return { ...booking, ...changes, updatedAt: now };
}

/** PENDING → CONFIRMED（系统确认） */
export function confirmRoomBooking(
  booking: RoomBooking,
  now: Date
): TransitionResult<RoomBooking> {
  if (booking.status !== "PENDING") {
    return fail(`无法确认：当前状态 ${booking.status}（仅 PENDING 可确认）`);
  }
  return result(patch(booking, { status: "CONFIRMED" }, now));
}

/** CONFIRMED → IN_PROGRESS（到点开始使用，开始计时） */
export function startRoomBooking(
  booking: RoomBooking,
  now: Date
): TransitionResult<RoomBooking> {
  if (booking.status !== "CONFIRMED") {
    return fail(`无法开始：当前状态 ${booking.status}（仅 CONFIRMED 可开始）`);
  }
  return result(patch(booking, { status: "IN_PROGRESS", startedAt: now }, now));
}

/** IN_PROGRESS → COMPLETED（结束使用，释放会议室） */
export function completeRoomBooking(
  booking: RoomBooking,
  now: Date
): TransitionResult<RoomBooking> {
  if (booking.status !== "IN_PROGRESS") {
    return fail(`无法完成：当前状态 ${booking.status}（仅 IN_PROGRESS 可完成）`);
  }
  return result(patch(booking, { status: "COMPLETED", completedAt: now }, now));
}

/**
 * IN_PROGRESS → COMPLETED（到点自动完成，由定时巡检调用）。
 *
 * 只在「预订结束 + 宽限期」之后触发；completedAt 记为预订结束时间，
 * 因此不会产生超时费——忘记点完成不应该被罚款。
 */
export function autoCompleteRoomBooking(
  booking: RoomBooking,
  now: Date,
  graceMs = AUTO_COMPLETE_GRACE_MS
): TransitionResult<RoomBooking> {
  if (booking.status !== "IN_PROGRESS") {
    return fail(`无法自动完成：当前状态 ${booking.status}（仅 IN_PROGRESS 可完成）`);
  }
  if (now.getTime() <= booking.endTime.getTime() + graceMs) {
    return fail(`尚未超过自动完成时间（结束 + ${Math.round(graceMs / 60_000)} 分钟）`);
  }
  return result(
    patch(booking, { status: "COMPLETED", completedAt: booking.endTime }, now)
  );
}

/** PENDING / CONFIRMED → CANCELLED */
export function cancelRoomBooking(
  booking: RoomBooking,
  cancelTime: Date
): TransitionResult<RoomBooking> {
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    return fail(`无法取消：当前状态 ${booking.status}`);
  }
  return result(patch(booking, { status: "CANCELLED", cancelledAt: cancelTime }, cancelTime));
}

export type { RoomBookingStatus };
