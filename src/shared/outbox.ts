import { and, eq } from "drizzle-orm";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import { outboxEvents } from "@/lib/db/schema";
import {
  getEventHandlers,
  type DomainEvent,
} from "@/shared/events";

/**
 * Outbox writer — appends events inside the caller's DB transaction.
 * Calling this within `db.transaction(async (tx) => { ... })` guarantees
 * business changes + event records commit atomically (transactional outbox).
 */
export async function appendOutboxEvents(
  tx: Pick<SQLiteTransaction<"async", any, any, any>, "insert">,
  events: DomainEvent[]
): Promise<void> {
  if (events.length === 0) return;
  await tx
    .insert(outboxEvents)
    .values(
      events.map((e) => ({
        aggregateId: e.aggregateId,
        aggregateType: e.aggregateType,
        eventType: e.eventType,
        payload: JSON.stringify(e.payload),
      }))
    )
    .run();
}

/**
 * Dispatcher — claims PENDING events, invokes registered handlers,
 * and marks each event PROCESSED or FAILED. At-least-once delivery.
 *
 * Phase 0 provides the mechanism; scheduled invocation (cron/route) comes
 * in later phases.
 */
export async function dispatchOutboxEvents(
  batchSize = 50
): Promise<{ processed: number; failed: number; skipped: number }> {
  const pending = await db
    .select()
    .from(outboxEvents)
    .where(and(eq(outboxEvents.status, "PENDING")))
    .limit(batchSize)
    .all();

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending) {
    const eventHandlers = getEventHandlers(row.eventType);
    if (eventHandlers.length === 0) {
      // 无订阅者：保留 PENDING 并记录日志，等待订阅者注册后重试。
      // 不标记 PROCESSED —— 否则事件被静默丢弃（破坏 at-least-once 语义）。
      console.warn(
        `[outbox] 事件 ${row.eventType} 无订阅者，保留 PENDING 等待重试 (id=${row.id})`
      );
      skipped += 1;
      continue;
    }

    let allSucceeded = true;
    for (const handler of eventHandlers) {
      try {
        await handler(JSON.parse(row.payload), {
          aggregateId: row.aggregateId,
          aggregateType: row.aggregateType,
          eventId: String(row.id),
        });
      } catch {
        allSucceeded = false;
      }
    }

    if (allSucceeded) {
      await db
        .update(outboxEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(outboxEvents.id, row.id))
        .run();
      processed += 1;
    } else {
      await db
        .update(outboxEvents)
        .set({
          status: "FAILED",
          attempts: (row.attempts ?? 0) + 1,
          processedAt: new Date(),
        })
        .where(eq(outboxEvents.id, row.id))
        .run();
      failed += 1;
    }
  }

  return { processed, failed, skipped };
}
