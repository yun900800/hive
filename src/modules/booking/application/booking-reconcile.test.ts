import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

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

type SeedInput = {
  status: "CONFIRMED" | "CHECKED_IN";
  startTime: Date;
  endTime: Date;
  checkedInAt?: Date | null;
};

async function seedDeskBooking(input: SeedInput): Promise<string> {
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

async function readBooking(id: string) {
  return testDb
    .select()
    .from(schema.deskBookings)
    .where(eq(schema.deskBookings.id, id))
    .get();
}

async function readOutbox() {
  return testDb.select().from(schema.outboxEvents).all();
}

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

    expect(result).toEqual({ checkedOut: 1, noShow: 0 });
    const row = await readBooking(id);
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

    expect(result).toEqual({ checkedOut: 0, noShow: 0 });
    expect((await readBooking(id))?.status).toBe("CHECKED_IN");
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

    expect(await booking.reconcileOverdueBookings()).toEqual({ checkedOut: 1, noShow: 0 });
    expect(await booking.reconcileOverdueBookings()).toEqual({ checkedOut: 0, noShow: 0 });
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

    expect(result).toEqual({ checkedOut: 0, noShow: 1 });
    expect((await readBooking(id))?.status).toBe("NO_SHOW");
  });

  it("仍在 15 分钟签到窗口内 → 保持 CONFIRMED", async () => {
    const start = new Date(Date.now() - 5 * MIN);
    const id = await seedDeskBooking({
      status: "CONFIRMED",
      startTime: start,
      endTime: new Date(start.getTime() + 120 * MIN),
    });

    const result = await booking.reconcileOverdueBookings();

    expect(result).toEqual({ checkedOut: 0, noShow: 0 });
    expect((await readBooking(id))?.status).toBe("CONFIRMED");
  });
});
