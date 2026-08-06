import { TimeSlot } from "@/shared";

/**
 * Booking availability — 同一资源同一时段的冲突校验（纯函数）。
 * 冲突状态：PENDING / CONFIRMED / CHECKED_IN / IN_PROGRESS（占用资源的预订）
 * 非冲突状态：CHECKED_OUT / COMPLETED / CANCELLED / NO_SHOW（已释放资源）
 */

const CONFLICTING_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
]);

/** 该预订状态是否占用资源（造成可用性冲突） */
export function isConflictingStatus(status: string): boolean {
  return CONFLICTING_STATUSES.has(status);
}

/** 已有的资源占用记录（最小结构） */
export type OccupiedSlot = {
  startTime: Date;
  endTime: Date;
  status: string;
};

/** 请求时段是否与任一条占用记录冲突 */
export function hasOverlapWithExisting(
  requested: TimeSlot,
  existing: OccupiedSlot[]
): boolean {
  return existing.some(
    (o) =>
      isConflictingStatus(o.status) &&
      TimeSlot.of(o.startTime, o.endTime).overlapsWith(requested)
  );
}

/** 找出第一条冲突记录（用于返回可读信息），无冲突返回 null */
export function findConflictingSlot(
  requested: TimeSlot,
  existing: OccupiedSlot[]
): OccupiedSlot | null {
  const hit = existing.find(
    (o) =>
      isConflictingStatus(o.status) &&
      TimeSlot.of(o.startTime, o.endTime).overlapsWith(requested)
  );
  return hit ?? null;
}
