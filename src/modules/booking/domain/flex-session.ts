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
