import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { outboxEvents, type OutboxEventRow, type OutboxStatus } from "@/lib/db/schema";
import { getEventHandlers, type DomainEvent } from "@/shared/events";
import { getEventSpec } from "@/shared/event-catalog";
import { logger } from "@/lib/logger";

/**
 * Outbox writer — appends events inside the caller's DB transaction.
 * Calling this within `db.transaction(async (tx) => { ... })` guarantees
 * business changes + event records commit atomically (transactional outbox).
 */
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function appendOutboxEvents(
  tx: Pick<DbTransaction, "insert">,
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

/** 失败重试上限；达到上限进入 DEAD，需要人工重放 */
export const MAX_ATTEMPTS = 5;
/** 认领超时：进程崩溃后锁会自动回收 */
const LOCK_TTL_MS = 60_000;
/** 「应该有人订阅但本进程没注册」的延迟，避免与正常事件争抢批次 */
const MISSING_SUBSCRIBER_DELAY_MS = 60_000;

export type DispatchResult = {
  /** 成功消费 */
  processed: number;
  /** 目录声明无人订阅，直接归档 */
  skipped: number;
  /** 本轮 handler 抛错（已排期重试） */
  failed: number;
  /** 重试次数耗尽 */
  dead: number;
  /** 订阅者未注册 / 事件未登记，已延迟重试 */
  deferred: number;
};

type OutboxPatch = {
  status?: OutboxStatus;
  attempts?: number;
  lastError?: string | null;
  nextAttemptAt?: Date | null;
  lockedAt?: Date | null;
  processedAt?: Date | null;
};

function emptyResult(): DispatchResult {
  return { processed: 0, skipped: 0, failed: 0, dead: 0, deferred: 0 };
}

async function patch(id: number, values: OutboxPatch): Promise<void> {
  await db.update(outboxEvents).set(values).where(eq(outboxEvents.id, id)).run();
}

/**
 * Dispatcher — claims PENDING events oldest-first, invokes registered handlers,
 * then moves each row to PROCESSED / SKIPPED / PENDING(retry) / DEAD.
 *
 * 关键修复（相对初版）：
 *  - 显式 ORDER BY id + (status, id) 索引：不会再被最老的滞留事件卡住；
 *  - UPDATE ... RETURNING 原子认领：并发 dispatcher 不会重复处理同一行；
 *  - 无人订阅的事件写 SKIPPED，不再永久占用批次；
 *  - 失败按指数退避重试，超过上限进 DEAD 并记录 lastError；
 *  - 旧版本留下的 FAILED 行会被自动复活重试。
 */
export async function dispatchOutboxEvents(batchSize = 50): Promise<DispatchResult> {
  const now = new Date();

  await reclaimStaleClaims(now);
  await reviveLegacyFailures();

  const candidates = await db
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.status, "PENDING"),
        or(isNull(outboxEvents.nextAttemptAt), lte(outboxEvents.nextAttemptAt, now))
      )
    )
    .orderBy(asc(outboxEvents.id))
    .limit(batchSize)
    .all();

  if (candidates.length === 0) return emptyResult();

  const claimed = await db
    .update(outboxEvents)
    .set({ status: "PROCESSING", lockedAt: now })
    .where(
      and(
        inArray(
          outboxEvents.id,
          candidates.map((row) => row.id)
        ),
        eq(outboxEvents.status, "PENDING")
      )
    )
    .returning()
    .all();

  const stats = emptyResult();
  for (const row of claimed) {
    await processRow(row, stats);
  }

  if (stats.failed > 0 || stats.dead > 0 || stats.deferred > 0) {
    logger.warn("outbox.dispatch", { ...stats, batchSize });
  }
  return stats;
}

async function processRow(row: OutboxEventRow, stats: DispatchResult): Promise<void> {
  const handlers = getEventHandlers(row.eventType);
  if (handlers.length === 0) {
    await handleMissingSubscriber(row, stats);
    return;
  }

  try {
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    for (const handler of handlers) {
      await handler(payload, {
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType,
        eventId: String(row.id),
      });
    }
    await patch(row.id, { status: "PROCESSED", processedAt: new Date(), lockedAt: null });
    stats.processed += 1;
  } catch (error) {
    await handleFailure(row, error, stats);
  }
}

async function handleMissingSubscriber(
  row: OutboxEventRow,
  stats: DispatchResult
): Promise<void> {
  if (getEventSpec(row.eventType)?.noSubscriber) {
    await patch(row.id, { status: "SKIPPED", processedAt: new Date(), lockedAt: null });
    stats.skipped += 1;
    return;
  }

  const message = `事件 ${row.eventType} 没有已注册的订阅者（检查对应模块的 bootstrap 导入）`;
  logger.warn("outbox.subscriber-missing", {
    eventId: row.id,
    eventType: row.eventType,
    aggregateId: row.aggregateId,
    registered: getEventSpec(row.eventType)?.owners ?? [],
  });
  await patch(row.id, {
    status: "PENDING",
    lockedAt: null,
    lastError: message,
    nextAttemptAt: new Date(Date.now() + MISSING_SUBSCRIBER_DELAY_MS),
  });
  stats.deferred += 1;
}

async function handleFailure(
  row: OutboxEventRow,
  error: unknown,
  stats: DispatchResult
): Promise<void> {
  const attempts = (row.attempts ?? 0) + 1;
  const message = error instanceof Error ? error.message : String(error);

  if (attempts >= MAX_ATTEMPTS) {
    await patch(row.id, {
      status: "DEAD",
      attempts,
      lastError: message,
      lockedAt: null,
    });
    stats.dead += 1;
  } else {
    const backoffMs = 2 ** (attempts - 1) * 60_000; // 1m, 2m, 4m, 8m
    await patch(row.id, {
      status: "PENDING",
      attempts,
      lastError: message,
      lockedAt: null,
      nextAttemptAt: new Date(Date.now() + backoffMs),
    });
    stats.failed += 1;
  }

  logger.error("outbox.handler-failed", {
    eventId: row.id,
    eventType: row.eventType,
    aggregateId: row.aggregateId,
    attempts,
    message,
  });
}

/** 回收崩溃进程遗留的 PROCESSING 行 */
async function reclaimStaleClaims(now: Date): Promise<void> {
  await db
    .update(outboxEvents)
    .set({ status: "PENDING", lockedAt: null })
    .where(
      and(
        eq(outboxEvents.status, "PROCESSING"),
        lt(outboxEvents.lockedAt, new Date(now.getTime() - LOCK_TTL_MS))
      )
    )
    .run();
}

/** 旧版本只会写 FAILED 且永不重试，这里把它们拉回队列（未超上限的） */
async function reviveLegacyFailures(): Promise<void> {
  await db
    .update(outboxEvents)
    .set({ status: "PENDING", lockedAt: null })
    .where(and(eq(outboxEvents.status, "FAILED"), lt(outboxEvents.attempts, MAX_ATTEMPTS)))
    .run();
}
