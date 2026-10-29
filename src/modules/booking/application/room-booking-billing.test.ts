import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// 独立临时 DB；先设 env 再动态 import（lib/db 模块级单例读 env）
const TEST_DB = path.resolve(`./data/test-room-booking-billing-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

const client = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(client, { schema });

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS member (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text,
  email text UNIQUE NOT NULL,
  tier text DEFAULT 'BASIC' NOT NULL,
  creditScore integer DEFAULT 100 NOT NULL,
  createdAt integer,
  updatedAt integer
);
CREATE TABLE IF NOT EXISTS plan (
  id text PRIMARY KEY,
  name text NOT NULL,
  planType text NOT NULL,
  monthlyFeeCents integer NOT NULL,
  freeFlexHours integer DEFAULT 0 NOT NULL,
  description text,
  isActive integer DEFAULT 1 NOT NULL,
  createdAt integer,
  updatedAt integer
);
CREATE TABLE IF NOT EXISTS subscription (
  id text PRIMARY KEY,
  memberId text NOT NULL,
  planId text NOT NULL,
  planType text NOT NULL,
  monthlyFeeCents integer NOT NULL,
  startDate integer NOT NULL,
  endDate integer NOT NULL,
  status text DEFAULT 'ACTIVE' NOT NULL,
  createdAt integer,
  updatedAt integer
);
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
CREATE TABLE IF NOT EXISTS resource_lock (
  resourceId text PRIMARY KEY NOT NULL,
  version integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_record (
  id text PRIMARY KEY,
  memberId text NOT NULL,
  chargeType text NOT NULL,
  description text NOT NULL,
  referenceId text NOT NULL,
  durationMs integer DEFAULT 0 NOT NULL,
  unitRateCents integer DEFAULT 0 NOT NULL,
  amountCents integer DEFAULT 0 NOT NULL,
  occurredAt integer NOT NULL,
  billingMonth text NOT NULL,
  createdAt integer DEFAULT (unixepoch()*1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS usage_record_ref_idx ON usage_record (chargeType, referenceId);
CREATE TABLE IF NOT EXISTS invoice (
  id text PRIMARY KEY,
  memberId text NOT NULL,
  billingMonth text NOT NULL,
  totalCents integer NOT NULL,
  discountRate integer DEFAULT 100 NOT NULL,
  discountAppliedCents integer DEFAULT 0 NOT NULL,
  paidAmountCents integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  dueDate integer NOT NULL,
  paidAt integer,
  createdAt integer NOT NULL,
  updatedAt integer DEFAULT (unixepoch()*1000)
);
CREATE TABLE IF NOT EXISTS invoice_line_item (
  id text PRIMARY KEY,
  invoiceId text NOT NULL,
  chargeType text NOT NULL,
  description text NOT NULL,
  amountCents integer NOT NULL,
  referenceId text,
  occurredAt integer
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
CREATE TABLE IF NOT EXISTS meeting_room (
  id text PRIMARY KEY,
  name text NOT NULL,
  capacity integer NOT NULL,
  equipments text,
  type text DEFAULT 'MEETING_ROOM' NOT NULL,
  status text DEFAULT 'AVAILABLE' NOT NULL,
  hourlyRateCents integer DEFAULT 3000 NOT NULL,
  createdAt integer,
  updatedAt integer
);
CREATE TABLE IF NOT EXISTS room_booking (
  id text PRIMARY KEY,
  memberId text NOT NULL,
  roomId text NOT NULL,
  startTime integer NOT NULL,
  endTime integer NOT NULL,
  expectedAttendees integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  startedAt integer,
  completedAt integer,
  cancelledAt integer,
  createdAt integer,
  updatedAt integer
);
`;

let memberId: string;
let roomId: string;

beforeAll(async () => {
  await client.executeMultiple(CREATE_TABLES);
  memberId = randomUUID();
  await testDb.insert(schema.members).values({
    id: memberId,
    name: "测试会员",
    email: `test-${randomUUID()}@example.com`,
    tier: "BASIC",
    creditScore: 100,
  }).run();
  roomId = randomUUID();
  await testDb.insert(schema.meetingRooms).values({
    id: roomId,
    name: "蓝鲸办公室",
    capacity: 4,
    type: "PRIVATE_OFFICE",
    status: "AVAILABLE",
    hourlyRateCents: 5000, // ¥50/时
  }).run();
});

beforeEach(async () => {
  await client.execute("DELETE FROM invoice_line_item");
  await client.execute("DELETE FROM invoice");
  await client.execute("DELETE FROM usage_record");
  await client.execute("DELETE FROM subscription");
  await client.execute("DELETE FROM outbox_event");
  await client.execute("DELETE FROM notification");
  await client.execute("DELETE FROM room_booking");
});

afterAll(async () => {
  await client.close();
  try { fs.unlinkSync(TEST_DB); } catch { /* ignore */ }
});

// 动态 import：确保 lib/db 读到测试 env
const booking = await import("./booking-app");
const { dispatchOutboxEvents } = await import("@/shared/outbox");
const { registerBillingSubscribers } = await import("../../billing/application/billing-subscribers");

// 注册事件订阅者（Billing 记录消费明细）
registerBillingSubscribers();

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function usages() {
  return testDb.select().from(schema.usageRecords).all();
}

describe("会议室/办公室计费 — 开始使用即出消费明细", () => {
  it("开始使用后立即写入 ROOM_USAGE（按预定时长计费）", async () => {
    const start = new Date(Date.now() + 60_000);
    const end = new Date(start.getTime() + 2 * 3600_000); // 预订 2 小时

    const created = await booking.createRoomBooking({
      memberId,
      roomId,
      startTime: start,
      endTime: end,
      expectedAttendees: 2,
    });

    // 预订阶段：无任何消费明细
    expect(await usages()).toHaveLength(0);

    // 开始使用 → 立即出消费明细
    await booking.startRoomBooking(created.id, memberId);
    await dispatchOutboxEvents();

    const rows = await usages();
    expect(rows).toHaveLength(1);
    const usage = rows[0];
    expect(usage.chargeType).toBe("ROOM_USAGE");
    expect(usage.referenceId).toBe(created.id);
    expect(usage.amountCents).toBe(10000); // ¥50/时 × 2 小时
    expect(usage.durationMs).toBe(2 * 3600_000);
    expect(usage.unitRateCents).toBe(5000);
    expect(usage.billingMonth).toBe(currentMonth());
  });

  it("完成使用（无超时）不重复计费，不新增消费明细", async () => {
    const start = new Date(Date.now() + 60_000);
    const end = new Date(start.getTime() + 3600_000); // 预订 1 小时

    const created = await booking.createRoomBooking({ memberId, roomId, startTime: start, endTime: end });
    await booking.startRoomBooking(created.id, memberId);
    await dispatchOutboxEvents();
    expect(await usages()).toHaveLength(1);

    // 完成使用（未超时）→ 不新增
    await booking.completeRoomBooking(created.id, memberId);
    await dispatchOutboxEvents();

    const rows = await usages();
    expect(rows).toHaveLength(1);
    expect(rows[0].chargeType).toBe("ROOM_USAGE");
    expect(rows[0].amountCents).toBe(5000); // ¥50/时 × 1 小时
  });

  it("完成使用（超时）追加 OVER_TIME_PENALTY，ROOM_USAGE 不重复", async () => {
    // 构造已开始的预订：预订结束时间已过（超时 30 分钟，超过免罚 15min）
    const bookingId = randomUUID();
    const start = new Date(Date.now() - 2 * 3600_000);
    const end = new Date(Date.now() - 30 * 60_000); // 预订结束于 30 分钟前
    await testDb.insert(schema.roomBookings).values({
      id: bookingId,
      memberId,
      roomId,
      startTime: start,
      endTime: end,
      expectedAttendees: 2,
      status: "IN_PROGRESS",
      startedAt: start,
    }).run();
    // 模拟开始使用时已写入 ROOM_USAGE（按预定时长 1.5 小时）
    await testDb.insert(schema.usageRecords).values({
      id: randomUUID(),
      memberId,
      chargeType: "ROOM_USAGE",
      description: "会议室使用费 ¥50/时",
      referenceId: bookingId,
      durationMs: end.getTime() - start.getTime(),
      unitRateCents: 5000,
      amountCents: 7500,
      occurredAt: start,
      billingMonth: currentMonth(),
    }).run();

    // 完成使用（实际结束 = now > 预订结束）→ 追加超时费
    await booking.completeRoomBooking(bookingId, memberId);
    await dispatchOutboxEvents();

    const rows = await usages();
    expect(rows).toHaveLength(2);
    const roomUsage = rows.find((u) => u.chargeType === "ROOM_USAGE");
    const overtime = rows.find((u) => u.chargeType === "OVER_TIME_PENALTY");
    expect(roomUsage?.amountCents).toBe(7500);
    expect(overtime).toBeDefined();
    expect(overtime?.referenceId).toBe(bookingId);
    expect(overtime?.amountCents).toBeGreaterThan(0);
  });

  it("并发预订同一会议室同一时段只成功一次", async () => {
    const start = new Date(Date.now() + 60_000);
    const end = new Date(start.getTime() + 3600_000);
    const input = { memberId, roomId, startTime: start, endTime: end };

    const results = await Promise.allSettled([
      booking.createRoomBooking(input),
      booking.createRoomBooking(input),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    const rows = await testDb.select().from(schema.roomBookings).all();
    expect(rows).toHaveLength(1);
  });
});