import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import {
  GATE_PASS_STATUSES,
  ACCESS_DIRECTIONS,
  ACCESS_RESULTS,
  type GatePassStatus,
  type AccessDirection,
  type AccessResult,
} from "../../domain/types";

/** gate_passes — 门禁通行证（Access 聚合根） */
export const gatePasses = sqliteTable(
  "gate_pass",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    code: text("code").unique().notNull(), // 通行证编码（扫码用）
    memberId: text("memberId").notNull(),
    bookingId: text("bookingId").notNull(),
    gatePassType: text("gatePassType").notNull(), // DESK / ROOM / FLEX
    validFrom: integer("validFrom", { mode: "timestamp_ms" }).notNull(),
    validTo: integer("validTo", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: GATE_PASS_STATUSES })
      .$type<GatePassStatus>()
      .default("ACTIVE")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("gate_pass_member_idx").on(table.memberId),
    index("gate_pass_booking_idx").on(table.bookingId),
    index("gate_pass_status_idx").on(table.status),
  ]
);

/** access_logs — 通行记录（Access 聚合根，审计/报表） */
export const accessLogs = sqliteTable(
  "access_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gatePassId: text("gatePassId").notNull(),
    memberId: text("memberId").notNull(),
    gateName: text("gateName").notNull(),
    direction: text("direction", { enum: ACCESS_DIRECTIONS })
      .$type<AccessDirection>()
      .notNull(),
    result: text("result", { enum: ACCESS_RESULTS })
      .$type<AccessResult>()
      .notNull(),
    accessTime: integer("accessTime", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("access_log_member_idx").on(table.memberId),
    index("access_log_time_idx").on(table.accessTime),
    index("access_log_result_idx").on(table.result),
  ]
);

export type GatePassRow = typeof gatePasses.$inferSelect;
export type NewGatePassRow = typeof gatePasses.$inferInsert;
export type AccessLogRow = typeof accessLogs.$inferSelect;
export type NewAccessLogRow = typeof accessLogs.$inferInsert;
