import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Outbox table for the transactional outbox pattern.
 *
 * Every application service writes domain events into this table within
 * the SAME transaction as its business changes. A background dispatcher
 * then publishes PENDING events to subscribers and marks them PROCESSED.
 * This guarantees at-least-once delivery without distributed transactions.
 *
 * Status lifecycle:
 *   PENDING → PROCESSING → PROCESSED
 *                        ↘ SKIPPED   (event type has no subscriber, see shared/event-catalog.ts)
 *                        ↘ PENDING   (retry with backoff while attempts < MAX)
 *                        ↘ DEAD      (attempts exhausted, needs manual replay)
 *
 * `lockedAt` makes claiming atomic so two dispatchers never process the same row;
 * `nextAttemptAt` implements exponential backoff; `lastError` keeps the failure reason.
 */
export const outboxEvents = sqliteTable(
  "outbox_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    aggregateId: text("aggregateId").notNull(),
    aggregateType: text("aggregateType").notNull(),
    eventType: text("eventType").notNull(),
    payload: text("payload").notNull(), // JSON string of the event payload
    status: text("status", {
      enum: ["PENDING", "PROCESSING", "PROCESSED", "SKIPPED", "FAILED", "DEAD"],
    })
      .default("PENDING")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("lastError"),
    nextAttemptAt: integer("nextAttemptAt", { mode: "timestamp_ms" }),
    lockedAt: integer("lockedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    processedAt: integer("processedAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    // Dispatcher reads PENDING rows oldest-first; without this index SQLite
    // full-scans and may pin the batch on events that never get consumed.
    index("outbox_event_status_idx").on(table.status, table.id),
  ]
);

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type NewOutboxEventRow = typeof outboxEvents.$inferInsert;
export type OutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "PROCESSED"
  | "SKIPPED"
  | "FAILED"
  | "DEAD";
