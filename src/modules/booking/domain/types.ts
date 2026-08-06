/**
 * Booking bounded context — domain types.
 * Pure TypeScript, no framework dependencies. Mirrors design/coworking-hive.cml.
 */

// ---------- 状态枚举 ----------

/** DeskBookingStatus — 工位预订生命周期 */
export const DESK_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type DeskBookingStatus = (typeof DESK_BOOKING_STATUSES)[number];

/** RoomBookingStatus — 会议室预订生命周期 */
export const ROOM_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type RoomBookingStatus = (typeof ROOM_BOOKING_STATUSES)[number];

/** FlexSessionStatus — 灵活区会话生命周期 */
export const FLEX_SESSION_STATUSES = ["ACTIVE", "COMPLETED", "NO_SHOW"] as const;
export type FlexSessionStatus = (typeof FLEX_SESSION_STATUSES)[number];

// ---------- 聚合实体 ----------

/** DeskBooking — 工位预订单（聚合根） */
export type DeskBooking = {
  id: string;
  memberId: string;
  deskId: string; // 引用 Facility 的工位
  startTime: Date;
  endTime: Date;
  status: DeskBookingStatus;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** RoomBooking — 会议室预订单（聚合根） */
export type RoomBooking = {
  id: string;
  memberId: string;
  roomId: string; // 引用 Facility 的会议室
  startTime: Date;
  endTime: Date;
  expectedAttendees: number;
  status: RoomBookingStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** FlexSession — 灵活区到访会话（聚合根） */
export type FlexSession = {
  id: string;
  memberId: string;
  zoneId: string; // 引用 Facility 的灵活区域
  checkInAt: Date;
  checkOutAt: Date | null;
  status: FlexSessionStatus;
  createdAt: Date;
  updatedAt: Date;
};

// ---------- 领域事件载荷 ----------

/** BookingConfirmed — 工位预订确认 → Access 创建 GatePass、Notification 通知 */
export type BookingConfirmedPayload = {
  bookingId: string;
  memberId: string;
  deskId: string;
  startTime: string; // ISO 字符串（JSON 可序列化）
  endTime: string;
};

/** BookingCheckedIn — 工位签到 → Billing 开始计时 */
export type BookingCheckedInPayload = {
  bookingId: string;
  memberId: string;
  checkInTime: string;
};

/** BookingCheckedOut — 工位签退 → Billing 结算 */
export type BookingCheckedOutPayload = {
  bookingId: string;
  memberId: string;
  checkOutTime: string;
  actualDurationMs: number;
};

/** RoomBookingCompleted — 会议室使用完成 → Billing 按实际时长计费 */
export type RoomBookingCompletedPayload = {
  roomBookingId: string;
  memberId: string;
  roomId: string;
  bookedStartTime: string; // 预订时段开始（Billing 计算超时用）
  bookedEndTime: string; // 预订时段结束（Billing 计算超时用）
  actualStartTime: string;
  actualEndTime: string;
};

/** FlexSessionStarted — 灵活区入场 → Access 创建 GatePass、Billing 开始计时 */
export type FlexSessionStartedPayload = {
  sessionId: string;
  memberId: string;
  zoneId: string;
  checkInTime: string;
};

/** FlexSessionEnded — 灵活区离场 → Billing 结算 */
export type FlexSessionEndedPayload = {
  sessionId: string;
  memberId: string;
  zoneId: string;
  checkOutTime: string;
  actualDurationMs: number;
};

/** BookingType — 预订类型（统一列表展示用） */
export type BookingType = "DESK" | "ROOM" | "FLEX";
