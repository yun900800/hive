import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import {
  DESK_BOOKING_STATUSES,
  ROOM_BOOKING_STATUSES,
  FLEX_SESSION_STATUSES,
  type DeskBookingStatus,
  type RoomBookingStatus,
  type FlexSessionStatus,
} from "../../domain/types";

/** desk_bookings — 工位预订单（Booking 聚合根） */
export const deskBookings = sqliteTable(
  "desk_booking",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId").notNull(),
    deskId: text("deskId").notNull(), // 引用 Facility 工位
    startTime: integer("startTime", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("endTime", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: DESK_BOOKING_STATUSES })
      .$type<DeskBookingStatus>()
      .default("PENDING")
      .notNull(),
    checkedInAt: integer("checkedInAt", { mode: "timestamp_ms" }),
    checkedOutAt: integer("checkedOutAt", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelledAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("desk_booking_resource_idx").on(table.deskId, table.startTime),
    index("desk_booking_member_idx").on(table.memberId),
    index("desk_booking_status_idx").on(table.status),
  ]
);

/** room_bookings — 会议室预订单（Booking 聚合根） */
export const roomBookings = sqliteTable(
  "room_booking",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId").notNull(),
    roomId: text("roomId").notNull(), // 引用 Facility 会议室
    startTime: integer("startTime", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("endTime", { mode: "timestamp_ms" }).notNull(),
    expectedAttendees: integer("expectedAttendees").default(0).notNull(),
    status: text("status", { enum: ROOM_BOOKING_STATUSES })
      .$type<RoomBookingStatus>()
      .default("PENDING")
      .notNull(),
    startedAt: integer("startedAt", { mode: "timestamp_ms" }),
    completedAt: integer("completedAt", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelledAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("room_booking_resource_idx").on(table.roomId, table.startTime),
    index("room_booking_member_idx").on(table.memberId),
    index("room_booking_status_idx").on(table.status),
  ]
);

/** flex_sessions — 灵活区到访会话（Booking 聚合根） */
export const flexSessions = sqliteTable(
  "flex_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId").notNull(),
    zoneId: text("zoneId").notNull(), // 引用 Facility 灵活区域
    checkInAt: integer("checkInAt", { mode: "timestamp_ms" }).notNull(),
    checkOutAt: integer("checkOutAt", { mode: "timestamp_ms" }),
    status: text("status", { enum: FLEX_SESSION_STATUSES })
      .$type<FlexSessionStatus>()
      .default("ACTIVE")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("flex_session_member_idx").on(table.memberId),
    index("flex_session_zone_idx").on(table.zoneId),
    index("flex_session_status_idx").on(table.status),
    // 一人同一时刻只能有一个在场会话。应用层的 check-then-act 挡不住并发，
    // 正确性交给这个部分唯一索引（与 subscription_active_member_idx 同一手法）。
    uniqueIndex("flex_session_active_member_idx")
      .on(table.memberId)
      .where(sql`${table.status} = 'ACTIVE'`),
  ]
);

/**
 * resource_lock — 预订写入的串行化锚点。
 *
 * SQLite 没有行锁，`SELECT 冲突 → INSERT` 在并发下会双卖同一资源。
 * 预订事务先对本表做一次 upsert（强制成为写事务），同一资源的并发请求
 * 因此被串行化，锁内再校验时段冲突。
 * 迁移到 PostgreSQL 时可替换为 `SELECT ... FOR UPDATE` + EXCLUDE 约束。
 */
export const resourceLocks = sqliteTable("resource_lock", {
  resourceId: text("resourceId").primaryKey(),
  version: integer("version").default(0).notNull(),
});

export type DeskBookingRow = typeof deskBookings.$inferSelect;
export type NewDeskBookingRow = typeof deskBookings.$inferInsert;
export type RoomBookingRow = typeof roomBookings.$inferSelect;
export type NewRoomBookingRow = typeof roomBookings.$inferInsert;
export type FlexSessionRow = typeof flexSessions.$inferSelect;
export type NewFlexSessionRow = typeof flexSessions.$inferInsert;
export type ResourceLockRow = typeof resourceLocks.$inferSelect;
