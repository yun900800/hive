import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

// 独立临时 DB；先设 env 再动态 import（lib/db 模块级单例读 env）
const TEST_DB = path.resolve(`./data/test-outbox-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

const client = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(client, { schema });

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS outbox_event (
  id integer PRIMARY KEY AUTOINCREMENT,
  aggregateId text NOT NULL,
  aggregateType text NOT NULL,
  eventType text NOT NULL,
  payload text NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  lastError text,
  nextAttemptAt integer,
  lockedAt integer,
  createdAt integer,
  processedAt integer
);
CREATE TABLE IF NOT EXISTS notification (
  id text PRIMARY KEY,
  memberId text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  channel text DEFAULT 'IN_APP' NOT NULL,
  status text DEFAULT 'SENT' NOT NULL,
  createdAt integer
);
`;

beforeAll(async () => {
  await client.executeMultiple(CREATE_TABLES);
});

beforeEach(async () => {
  await client.execute("DELETE FROM outbox_event");
  await client.execute("DELETE FROM notification");
});

afterAll(async () => {
  await client.close();
  try {
    fs.unlinkSync(TEST_DB);
  } catch {
    /* ignore */
  }
});

const { dispatchOutboxEvents, MAX_ATTEMPTS } = await import("@/shared/outbox");
const { registerEventHandler } = await import("@/shared/events");
const { registerNotificationSubscribers } = await import(
  "../modules/notification/application/notification-subscribers"
);

async function insertEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
  options: { attempts?: number; status?: string } = {}
): Promise<number> {
  const result = await client.execute(
    "INSERT INTO outbox_event (aggregateId, aggregateType, eventType, payload, status, attempts, createdAt) VALUES (?, 'Test', ?, ?, ?, ?, ?)",
    [
      `agg-${Date.now()}-${Math.random()}`,
      eventType,
      JSON.stringify(payload),
      options.status ?? "PENDING",
      options.attempts ?? 0,
      Date.now(),
    ]
  );
  return Number(result.lastInsertRowid);
}

async function getEvent(id: number) {
  return testDb
    .select()
    .from(schema.outboxEvents)
    .where(eq(schema.outboxEvents.id, id))
    .get();
}

/** 让「延迟重试」的事件立刻可被再次选中（测试里不想等 60 秒） */
async function clearBackoff(id: number): Promise<void> {
  await client.execute("UPDATE outbox_event SET nextAttemptAt = NULL WHERE id = ?", [id]);
}

describe("dispatchOutboxEvents — 事件生命周期", () => {
  it("目录声明无订阅者的事件直接 SKIPPED，不再占用批次", async () => {
    const eventId = await insertEvent("membership.member-registered");

    const result = await dispatchOutboxEvents();

    expect(result.skipped).toBe(1);
    const row = await getEvent(eventId);
    expect(row?.status).toBe("SKIPPED");
  });

  it("未登记的事件类型保留 PENDING 并延迟重试，注册后可被消费", async () => {
    const eventId = await insertEvent("test.deferred.event", { ok: true });

    const first = await dispatchOutboxEvents();
    expect(first.deferred).toBe(1);

    const pending = await getEvent(eventId);
    expect(pending?.status).toBe("PENDING"); // 关键：不静默丢弃
    expect(pending?.lastError).toContain("没有已注册的订阅者");
    expect(pending?.nextAttemptAt).not.toBeNull();

    registerEventHandler("test.deferred.event", async () => {
      // 模拟消费成功
    });
    await clearBackoff(eventId);

    const second = await dispatchOutboxEvents();
    expect(second.processed).toBe(1);
    expect((await getEvent(eventId))?.status).toBe("PROCESSED");
  });

  it("有订阅者的事件被消费并写入通知", async () => {
    registerNotificationSubscribers();
    const eventId = await insertEvent("billing.invoice-issued", {
      invoiceId: "inv-1",
      memberId: "m1",
      billingMonth: "2026-08",
      totalCents: 49900,
    });

    const result = await dispatchOutboxEvents();

    expect(result.processed).toBe(1);
    expect((await getEvent(eventId))?.status).toBe("PROCESSED");
    const notifications = await testDb.select().from(schema.notifications).all();
    expect(notifications).toHaveLength(1);
  });

  it("大量滞留事件不会饿死后面的事件", async () => {
    registerNotificationSubscribers();
    for (let i = 0; i < 50; i += 1) {
      await insertEvent("membership.subscription-cancelled");
    }
    const invoiceId = await insertEvent("billing.invoice-issued", {
      invoiceId: "inv-late",
      memberId: "m1",
      billingMonth: "2026-08",
      totalCents: 100,
    });

    // 第一批被 50 个滞留事件占满（但它们是 SKIPPED，会被清空）
    const first = await dispatchOutboxEvents(50);
    expect(first.skipped).toBe(50);
    expect((await getEvent(invoiceId))?.status).toBe("PENDING");

    // 下一批必须能取到后来者
    const second = await dispatchOutboxEvents(50);
    expect(second.processed).toBe(1);
    expect((await getEvent(invoiceId))?.status).toBe("PROCESSED");
  });

  it("handler 抛错时排期重试并记录 lastError", async () => {
    registerEventHandler("test.failing.event", async () => {
      throw new Error("boom");
    });
    const eventId = await insertEvent("test.failing.event");

    const result = await dispatchOutboxEvents();

    expect(result.failed).toBe(1);
    const row = await getEvent(eventId);
    expect(row?.status).toBe("PENDING");
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toContain("boom");
    expect(row?.nextAttemptAt).not.toBeNull();
  });

  it("重试次数耗尽后进入 DEAD", async () => {
    registerEventHandler("test.dead.event", async () => {
      throw new Error("always fails");
    });
    const eventId = await insertEvent("test.dead.event", {}, {
      attempts: MAX_ATTEMPTS - 1,
    });

    const result = await dispatchOutboxEvents();

    expect(result.dead).toBe(1);
    const row = await getEvent(eventId);
    expect(row?.status).toBe("DEAD");
    expect(row?.attempts).toBe(MAX_ATTEMPTS);
  });

  it("并发 dispatch 不会重复消费同一条事件", async () => {
    let consumed = 0;
    registerEventHandler("test.concurrent.event", async () => {
      consumed += 1;
    });
    for (let i = 0; i < 20; i += 1) {
      await insertEvent("test.concurrent.event");
    }

    await Promise.all([dispatchOutboxEvents(50), dispatchOutboxEvents(50)]);

    expect(consumed).toBe(20);
    const rows = await testDb.select().from(schema.outboxEvents).all();
    expect(rows.every((row) => row.status === "PROCESSED")).toBe(true);
  });
});
