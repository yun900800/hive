import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { endOfDay } from "@/shared/clock";

// 独立临时 DB；先设 env 再动态 import（lib/db 模块级单例读 env）
const TEST_DB = path.resolve(`./data/test-reconcile-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

const client = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(client, { schema });

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS desk_booking (
  id text PRIMARY KEY NOT NULL,
  memberId text NOT NULL,
  deskId text NOT NULL,
  startTime integer NOT NULL,
  endTime integer NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  checkedInAt integer,
  checkedOutAt integer,
  cancelledAt integer,
  createdAt integer,
  updatedAt integer
);

CREATE TABLE IF NOT EXISTS room_booking (
  id text PRIMARY KEY NOT NULL,
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

CREATE TABLE IF NOT EXISTS flex_session (
  id text PRIMARY KEY NOT NULL,
  memberId text NOT NULL,
  zoneId text NOT NULL,
  checkInAt integer NOT NULL,
  checkOutAt integer,
  status text DEFAULT 'ACTIVE' NOT NULL,
  createdAt integer,
  updatedAt integer
);

CREATE TABLE IF NOT EXISTS outbox_event (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
`;

beforeAll(async () => {
  await client.executeMultiple(CREATE_TABLES);
});

beforeEach(async () => {
  await client.execute("DELETE FROM desk_booking");
  await client.execute("DELETE FROM room_booking");
  await client.execute("DELETE FROM flex_session");
  await client.execute("DELETE FROM outbox_event");
});

afterAll(async () => {
  await client.close();
  try {
    fs.unlinkSync(TEST_DB);
  } catch {
    /* ignore */
  }
});

const booking = await import("./booking-app");

const MIN = 60_000;

async function seedDeskBooking(input: {
  status: "CONFIRMED" | "CHECKED_IN";
  startTime: Date;
  endTime: Date;
  checkedInAt?: Date | null;
}): Promise<string> {
  const id = randomUUID();
  await testDb
    .insert(schema.deskBookings)
    .values({
      id,
      memberId: randomUUID(),
      deskId: randomUUID(),
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      checkedInAt: input.checkedInAt ?? null,
    })
    .run();
  return id;
}

async function seedRoomBooking(input: {
  status: "CONFIRMED" | "IN_PROGRESS";
  startTime: Date;
  endTime: Date;
  startedAt?: Date | null;
}): Promise<string> {
  const id = randomUUID();
  await testDb
    .insert(schema.roomBookings)
    .values({
      id,
      memberId: randomUUID(),
      roomId: randomUUID(),
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status,
      startedAt: input.startedAt ?? null,
    })
    .run();
  return id;
}

async function seedFlexSession(input: {
  status?: "ACTIVE" | "COMPLETED";
  checkInAt: Date;
}): Promise<string> {
  const id = randomUUID();
  await testDb
    .insert(schema.flexSessions)
    .values({
      id,
      memberId: randomUUID(),
      zoneId: randomUUID(),
      checkInAt: input.checkInAt,
      status: input.status ?? "ACTIVE",
    })
    .run();
  return id;
}

async function readOutbox() {
  return testDb.select().from(schema.outboxEvents).all();
}

const EMPTY_RESULT = {
  deskCheckedOut: 0,
  deskNoShow: 0,
  flexCompleted: 0,
  roomsCompleted: 0,
};

describe("reconcileOverdueBookings — 到期自动签退", () => {
  it("超过结束 + 宽限期 → CHECKED_OUT，签退时间记为 endTime 并发出事件", async () => {
    const end = new Date(Date.now() - 60 * MIN);
    const id = await seedDeskBooking({
      status: "CHECKED_IN",
      startTime: new Date(end.getTime() - 120 * MIN),
      endTime: end,
      checkedInAt: new Date(end.getTime() - 110 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual({ ...EMPTY_RESULT, deskCheckedOut: 1 });
    const row = await testDb
      .select()
      .from(schema.deskBookings)
      .where(eq(schema.deskBookings.id, id))
      .get();
    expect(row?.status).toBe("CHECKED_OUT");
    expect(row?.checkedOutAt?.toISOString()).toBe(end.toISOString());

    const events = await readOutbox();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("booking.booking-checked-out");
    const payload = JSON.parse(events[0].payload) as Record<string, unknown>;
    expect(payload.auto).toBe(true);
    expect(payload.checkOutTime).toBe(end.toISOString());
  });

  it("仍在宽限期内 → 不自动签退", async () => {
    const end = new Date(Date.now() - 5 * MIN);
    const id = await seedDeskBooking({
      status: "CHECKED_IN",
      startTime: new Date(end.getTime() - 120 * MIN),
      endTime: end,
      checkedInAt: new Date(end.getTime() - 110 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual(EMPTY_RESULT);
    const row = await testDb
      .select()
      .from(schema.deskBookings)
      .where(eq(schema.deskBookings.id, id))
      .get();
    expect(row?.status).toBe("CHECKED_IN");
    expect(await readOutbox()).toHaveLength(0);
  });

  it("重复执行幂等：第二次不重复签退、不重复发事件", async () => {
    const end = new Date(Date.now() - 60 * MIN);
    await seedDeskBooking({
      status: "CHECKED_IN",
      startTime: new Date(end.getTime() - 120 * MIN),
      endTime: end,
      checkedInAt: new Date(end.getTime() - 110 * MIN),
    });

    expect(await booking.reconcileOverdueBookings()).toEqual({
      ...EMPTY_RESULT,
      deskCheckedOut: 1,
    });
    expect(await booking.reconcileOverdueBookings()).toEqual(EMPTY_RESULT);
    expect(await readOutbox()).toHaveLength(1);
  });
});

describe("reconcileOverdueBookings — 自动爽约", () => {
  it("确认后超过 15 分钟未签到 → NO_SHOW", async () => {
    const start = new Date(Date.now() - 30 * MIN);
    const id = await seedDeskBooking({
      status: "CONFIRMED",
      startTime: start,
      endTime: new Date(start.getTime() + 120 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual({ ...EMPTY_RESULT, deskNoShow: 1 });
    const row = await testDb
      .select()
      .from(schema.deskBookings)
      .where(eq(schema.deskBookings.id, id))
      .get();
    expect(row?.status).toBe("NO_SHOW");
  });

  it("仍在 15 分钟签到窗口内 → 保持 CONFIRMED", async () => {
    const start = new Date(Date.now() - 5 * MIN);
    const id = await seedDeskBooking({
      status: "CONFIRMED",
      startTime: start,
      endTime: new Date(start.getTime() + 120 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual(EMPTY_RESULT);
    const row = await testDb
      .select()
      .from(schema.deskBookings)
      .where(eq(schema.deskBookings.id, id))
      .get();
    expect(row?.status).toBe("CONFIRMED");
  });
});

describe("reconcileOverdueBookings — 灵活区当日结束自动离场", () => {
  it("跨天仍 ACTIVE → COMPLETED，离场时间记为当日 23:59:59", async () => {
    const checkInAt = new Date(Date.now() - 26 * 60 * MIN);
    const expectedCheckOut = endOfDay(checkInAt);
    const id = await seedFlexSession({ checkInAt });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual({ ...EMPTY_RESULT, flexCompleted: 1 });
    const row = await testDb
      .select()
      .from(schema.flexSessions)
      .where(eq(schema.flexSessions.id, id))
      .get();
    expect(row?.status).toBe("COMPLETED");
    expect(row?.checkOutAt?.toISOString()).toBe(expectedCheckOut.toISOString());

    const events = await readOutbox();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("booking.flex-session-ended");
    const payload = JSON.parse(events[0].payload) as Record<string, unknown>;
    expect(payload.auto).toBe(true);
    expect(payload.checkOutTime).toBe(expectedCheckOut.toISOString());
  });

  it("当天入场仍 ACTIVE → 保持不变", async () => {
    const id = await seedFlexSession({ checkInAt: new Date(Date.now() - 2 * 60 * MIN) });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual(EMPTY_RESULT);
    const row = await testDb
      .select()
      .from(schema.flexSessions)
      .where(eq(schema.flexSessions.id, id))
      .get();
    expect(row?.status).toBe("ACTIVE");
  });
});

describe("reconcileOverdueBookings — 会议室到点自动完成", () => {
  it("超过结束 + 宽限期 → COMPLETED，完成时间记为 endTime（无超时费）", async () => {
    const end = new Date(Date.now() - 60 * MIN);
    const id = await seedRoomBooking({
      status: "IN_PROGRESS",
      startTime: new Date(end.getTime() - 60 * MIN),
      endTime: end,
      startedAt: new Date(end.getTime() - 58 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual({ ...EMPTY_RESULT, roomsCompleted: 1 });
    const row = await testDb
      .select()
      .from(schema.roomBookings)
      .where(eq(schema.roomBookings.id, id))
      .get();
    expect(row?.status).toBe("COMPLETED");
    expect(row?.completedAt?.toISOString()).toBe(end.toISOString());

    const events = await readOutbox();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("booking.room-booking-completed");
    const payload = JSON.parse(events[0].payload) as Record<string, unknown>;
    expect(payload.auto).toBe(true);
    expect(payload.actualEndTime).toBe(end.toISOString());
  });

  it("仍在宽限期内 → 保持 IN_PROGRESS", async () => {
    const end = new Date(Date.now() - 5 * MIN);
    const id = await seedRoomBooking({
      status: "IN_PROGRESS",
      startTime: new Date(end.getTime() - 60 * MIN),
      endTime: end,
      startedAt: new Date(end.getTime() - 58 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual(EMPTY_RESULT);
    const row = await testDb
      .select()
      .from(schema.roomBookings)
      .where(eq(schema.roomBookings.id, id))
      .get();
    expect(row?.status).toBe("IN_PROGRESS");
  });
});
