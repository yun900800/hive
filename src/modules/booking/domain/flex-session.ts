import type { FlexSession, FlexSessionStatus } from "./types";

/**
 * FlexSession state machine — 灵活区到访会话（纯函数）。
 *
 *   ACTIVE ──离场──► COMPLETED
 *     │
 *     └──────► NO_SHOW（边缘：预约了但未到，按需入场流程不触发）
 */

export type TransitionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type SessionPatch = Partial<FlexSession>;

function result(value: FlexSession): TransitionResult<FlexSession> {
  return { ok: true, value };
}

function fail(msg: string): TransitionResult<FlexSession> {
  return { ok: false, error: msg };
}

function patch(session: FlexSession, changes: SessionPatch, now: Date): FlexSession {
  return { ...session, ...changes, updatedAt: now };
}

/** ACTIVE → COMPLETED（离场签退） */
export function endFlexSession(
  session: FlexSession,
  now: Date
): TransitionResult<FlexSession> {
  if (session.status !== "ACTIVE") {
    return fail(`无法离场：当前状态 ${session.status}（仅 ACTIVE 可离场）`);
  }
  return result(patch(session, { status: "COMPLETED", checkOutAt: now }, now));
}

/**
 * ACTIVE → COMPLETED（当日结束自动离场，由定时巡检调用）。
 *
 * 灵活区按天授权（通行证有效至当天 23:59:59），忘记签退不应把会话永远卡在
 * ACTIVE；自动签退时间记为 validUntil，而不是巡检实际运行时间。
 */
export function autoEndFlexSession(
  session: FlexSession,
  validUntil: Date,
  now: Date
): TransitionResult<FlexSession> {
  if (session.status !== "ACTIVE") {
    return fail(`无法自动离场：当前状态 ${session.status}（仅 ACTIVE 可离场）`);
  }
  if (now.getTime() <= validUntil.getTime()) {
    return fail("尚未到当日结束，不能自动离场");
  }
  return result(
    patch(session, { status: "COMPLETED", checkOutAt: validUntil }, now)
  );
}

/** ACTIVE → NO_SHOW（边缘场景：预留入场未到） */
export function markFlexNoShow(
  session: FlexSession,
  now: Date
): TransitionResult<FlexSession> {
  if (session.status !== "ACTIVE") {
    return fail(`无法标记 NoShow：当前状态 ${session.status}（仅 ACTIVE 可判定）`);
  }
  return result(patch(session, { status: "NO_SHOW" }, now));
}

export type { FlexSessionStatus };
