import { TimeSlot } from "@/shared";
import type { DeskStatus, RoomStatus } from "./types";

/**
 * ResourceAvailabilityService — domain layer (pure functions).
 * 资源可用性规则：只有 AVAILABLE 状态的资源才可被预订。
 */

/** 工位是否可预订：状态必须为 AVAILABLE（OCCUPIED/RESERVED/维护中 均不可订） */
export function isDeskAvailable(status: DeskStatus): boolean {
  return status === "AVAILABLE";
}

/** 会议室是否可预订：状态必须为 AVAILABLE */
export function isRoomAvailable(status: RoomStatus): boolean {
  return status === "AVAILABLE";
}

/** 两个时段是否冲突（同一资源） */
export function hasSlotConflict(a: TimeSlot, b: TimeSlot): boolean {
  return a.overlapsWith(b);
}
