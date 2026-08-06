import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Outbox table for the transactional outbox pattern.
 *
 * Every application service writes domain events into this table within
 * the SAME transaction as its business changes. A background dispatcher
 * then publishes PENDING events to subscribers and marks them PROCESSED.
 * This guarantees at-least-once delivery without distributed transactions.
 */
export const outboxEvents = sqliteTable("outbox_event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aggregateId: text("aggregateId").notNull(),
  aggregateType: text("aggregateType").notNull(),
  eventType: text("eventType").notNull(),
  payload: text("payload").notNull(), // JSON string of the event payload
  status: text("status", {
    enum: ["PENDING", "PROCESSED", "FAILED"],
  })
    .default("PENDING")
    .notNull(),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date()),
  processedAt: integer("processedAt", { mode: "timestamp_ms" }),
});

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type NewOutboxEventRow = typeof outboxEvents.$inferInsert;
export type OutboxStatus = "PENDING" | "PROCESSED" | "FAILED";
