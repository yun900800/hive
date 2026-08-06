import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  type NotificationChannel,
  type NotificationStatus,
} from "../../domain/types";

/** notifications — 通知消息（Notification 聚合根，in-app） */
export const notifications = sqliteTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    channel: text("channel", { enum: NOTIFICATION_CHANNELS })
      .$type<NotificationChannel>()
      .default("IN_APP")
      .notNull(),
    status: text("status", { enum: NOTIFICATION_STATUSES })
      .$type<NotificationStatus>()
      .default("SENT")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("notification_member_idx").on(table.memberId)]
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
