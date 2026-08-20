/**
 * Facility bounded context — domain types.
 * Pure TypeScript, no framework dependencies. Mirrors `design/coworking-hive.cml`.
 */

/** DeskType — 工位类型 */
export const DESK_TYPES = [
  "STANDARD",
  "WINDOW_SIDE",
  "QUIET_ZONE",
  "STANDING",
] as const;
export type DeskType = (typeof DESK_TYPES)[number];

/** DeskStatus — 工位状态 */
export const DESK_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "UNDER_MAINTENANCE",
] as const;
export type DeskStatus = (typeof DESK_STATUSES)[number];

/** RoomStatus — 会议室状态 */
export const ROOM_STATUSES = ["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

/** RoomType — 空间类型：会议室 / 独立办公室（复用同一资源表与预订/计费流程） */
export const ROOM_TYPES = ["MEETING_ROOM", "PRIVATE_OFFICE"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/** FlexZoneStatus — 灵活区域状态 */
export const FLEX_ZONE_STATUSES = ["OPEN", "CLOSED", "UNDER_MAINTENANCE"] as const;
export type FlexZoneStatus = (typeof FLEX_ZONE_STATUSES)[number];

/** GateType — 闸机类型 */
export const GATE_TYPES = [
  "ENTRY_TURNSTILE",
  "EXIT_TURNSTILE",
  "EMERGENCY_EXIT",
  "ELEVATOR_CONTROL",
] as const;
export type GateType = (typeof GATE_TYPES)[number];

/** GateStatus — 闸机运行状态 */
export const GATE_STATUSES = [
  "OPERATIONAL",
  "UNDER_MAINTENANCE",
  "OFFLINE",
  "OUT_OF_SERVICE",
] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

/** DeskId value object — 工位编码，如 "B-12" */
export type DeskId = {
  floorCode: string;
  zoneCode: string;
  number: number;
};

/** RoomId — 会议室 ID */
export type RoomId = string;

/** ZoneId value object — 区域编码 */
export type ZoneId = {
  floorCode: string;
  zoneCode: string;
};

/** GateId value object — 闸机编码 */
export type GateId = {
  floorCode: string;
  zoneCode: string;
  number: number;
};

/** 工位领域实体 */
export type Desk = {
  id: string;
  floor: string;
  zone: string;
  deskNumber: string;
  code: string; // 派生编码，如 "B-12"
  type: DeskType;
  status: DeskStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** 会议室领域实体 */
export type MeetingRoom = {
  id: string;
  name: string;
  capacity: number;
  equipments: string[];
  status: RoomStatus;
  hourlyRateCents: number;
  createdAt: Date;
  updatedAt: Date;
};

/** 灵活区域领域实体 */
export type FlexZone = {
  id: string;
  name: string;
  floor: string;
  capacity: number;
  openingTime: string; // "08:00"
  closingTime: string; // "22:00"
  status: FlexZoneStatus;
  createdAt: Date;
  updatedAt: Date;
};

/** 闸机领域实体 */
export type Gate = {
  id: string;
  name: string;
  floor: string;
  zone: string;
  type: GateType;
  status: GateStatus;
  createdAt: Date;
  updatedAt: Date;
};
