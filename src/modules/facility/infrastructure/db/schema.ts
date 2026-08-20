import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import {
  DESK_TYPES,
  DESK_STATUSES,
  ROOM_TYPES,
  ROOM_STATUSES,
  FLEX_ZONE_STATUSES,
  GATE_TYPES,
  GATE_STATUSES,
  type DeskType,
  type DeskStatus,
  type RoomType,
  type RoomStatus,
  type FlexZoneStatus,
  type GateType,
  type GateStatus,
} from "../../domain/types";

/** desks — 工位（Facility 聚合根） */
export const desks = sqliteTable(
  "desk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    floor: text("floor").notNull(), // 楼层，如 "B"
    zone: text("zone").notNull(), // 区域，如 "1"
    deskNumber: text("deskNumber").notNull(), // 编号，如 "2"
    code: text("code").unique().notNull(), // 派生编码，如 "B-12"
    type: text("type", { enum: DESK_TYPES })
      .$type<DeskType>()
      .default("STANDARD")
      .notNull(),
    status: text("status", { enum: DESK_STATUSES })
      .$type<DeskStatus>()
      .default("AVAILABLE")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("desk_code_idx").on(table.code)]
);

/** meeting_rooms — 会议室（Facility 聚合根） */
export const meetingRooms = sqliteTable(
  "meeting_room",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull(),
    equipments: text("equipments"), // JSON 字符串数组
    type: text("type", { enum: ROOM_TYPES })
      .$type<RoomType>()
      .default("MEETING_ROOM")
      .notNull(),
    status: text("status", { enum: ROOM_STATUSES })
      .$type<RoomStatus>()
      .default("AVAILABLE")
      .notNull(),
    hourlyRateCents: integer("hourlyRateCents").default(3000).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("room_status_idx").on(table.status)]
);

/** flex_zones — 灵活区域（Facility 聚合根） */
export const flexZones = sqliteTable(
  "flex_zone",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    floor: text("floor").notNull(),
    capacity: integer("capacity").notNull(),
    openingTime: text("openingTime").default("08:00").notNull(),
    closingTime: text("closingTime").default("22:00").notNull(),
    status: text("status", { enum: FLEX_ZONE_STATUSES })
      .$type<FlexZoneStatus>()
      .default("OPEN")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("zone_status_idx").on(table.status)]
);

/** gates — 闸机设备（Facility 聚合根，物理资产） */
export const gates = sqliteTable(
  "gate",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    floor: text("floor").notNull(),
    zone: text("zone").notNull(),
    type: text("type", { enum: GATE_TYPES })
      .$type<GateType>()
      .default("ENTRY_TURNSTILE")
      .notNull(),
    status: text("status", { enum: GATE_STATUSES })
      .$type<GateStatus>()
      .default("OPERATIONAL")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("gate_status_idx").on(table.status)]
);

export type DeskRow = typeof desks.$inferSelect;
export type NewDeskRow = typeof desks.$inferInsert;
export type MeetingRoomRow = typeof meetingRooms.$inferSelect;
export type NewMeetingRoomRow = typeof meetingRooms.$inferInsert;
export type FlexZoneRow = typeof flexZones.$inferSelect;
export type NewFlexZoneRow = typeof flexZones.$inferInsert;
export type GateRow = typeof gates.$inferSelect;
export type NewGateRow = typeof gates.$inferInsert;
