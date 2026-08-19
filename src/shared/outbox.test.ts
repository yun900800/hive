import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
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
  try { fs.unlinkSync(TEST_DB); } catch { /* ignore */ }
});

const { dispatchOutboxEvents } = await import("@/shared/outbox");
const { registerNotificationSubscribers } = await import("../modules/notification/application/notification-subscribers");

describe("dispatchOutboxEvents — 无订阅者事件处理", () => {
  it("无订阅者的事件保留 PENDING（不静默丢弃），注册订阅者后重试可被消费", async () => {
    // 插入一个无订阅者的事件
    const ins = await client.execute(
      "INSERT INTO outbox_event (aggregateId, aggregateType, eventType, payload, status, createdAt) VALUES ('agg-1', 'Test', 'unknown.event-type', '{}', 'PENDING', ?)",
      [Date.now()]
    );
    const eventId = Number(ins.lastInsertRowid);

    // 第一次 dispatch：无订阅者 → 事件应保留 PENDING（不标记 PROCESSED）
    const r1 = await dispatchOutboxEvents();
    expect(r1.skipped).toBe(1);
    const ev1 = await testDb.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.id, eventId)).get();
    expect(ev1?.status).toBe("PENDING"); // 关键：不静默丢弃

    // 注册订阅者后重试 → 事件被消费
    registerEventHandlerForTest();
    const r2 = await dispatchOutboxEvents();
    expect(r2.processed).toBe(1);
    const ev2 = await testDb.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.id, eventId)).get();
    expect(ev2?.status).toBe("PROCESSED");
  });

  it("有订阅者的事件正常消费并标记 PROCESSED", async () => {
    registerNotificationSubscribers();
    const ins = await client.execute(
      "INSERT INTO outbox_event (aggregateId, aggregateType, eventType, payload, status, createdAt) VALUES ('inv-1', 'Invoice', 'billing.invoice-issued', '{\"invoiceId\":\"inv-1\",\"memberId\":\"m1\",\"billingMonth\":\"2026-08\",\"totalCents\":49900}', 'PENDING', ?)",
      [Date.now()]
    );
    const eventId = Number(ins.lastInsertRowid);

    const r = await dispatchOutboxEvents();
    expect(r.processed).toBe(1);
    const ev = await testDb.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.id, eventId)).get();
    expect(ev?.status).toBe("PROCESSED");
    const notifs = await testDb.select().from(schema.notifications).all();
    expect(notifs).toHaveLength(1);
  });
});

// 测试用：注册一个临时订阅者
import { registerEventHandler } from "@/shared/events";
function registerEventHandlerForTest() {
  registerEventHandler("unknown.event-type", async () => {
    // 模拟消费成功
  });
}