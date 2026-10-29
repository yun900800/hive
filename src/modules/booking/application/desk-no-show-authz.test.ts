import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// 独立临时 DB；先设 env 再动态 import（lib/db 模块级单例读 env）
const TEST_DB = path.resolve(`./data/test-noshow-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

const client = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(client, { schema });

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS desk_booking (
  id text PRIMARY KEY,
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
`;

beforeAll(async () => {
  await client.executeMultiple(CREATE_TABLES);
});

beforeEach(async () => {
  await client.execute("DELETE FROM desk_booking");
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

const OWNER = "member-owner";
const OTHER = "member-other";

async function seedNoShowCandidate(memberId = OWNER): Promise<string> {
  const id = randomUUID();
  const start = new Date(Date.now() - 30 * 60_000); // 已开始 30 分钟 → 满足 NoShow 判定
  await testDb
    .insert(schema.deskBookings)
    .values({
      id,
      memberId,
      deskId: randomUUID(),
      startTime: start,
      endTime: new Date(start.getTime() + 3600_000),
      status: "CONFIRMED",
    })
    .run();
  return id;
}

describe("markDeskNoShow — 授权", () => {
  it("普通会员不能标记他人的预订", async () => {
    const id = await seedNoShowCandidate(OWNER);

    await expect(
      booking.markDeskNoShow(id, { memberId: OTHER, isAdmin: false })
    ).rejects.toThrow("无权操作他人的预订");
  });

  it("会员可以标记自己的预订", async () => {
    const id = await seedNoShowCandidate(OWNER);

    const result = await booking.markDeskNoShow(id, { memberId: OWNER, isAdmin: false });

    expect(result.status).toBe("NO_SHOW");
  });

  it("管理员可以标记任意预订", async () => {
    const id = await seedNoShowCandidate(OWNER);

    const result = await booking.markDeskNoShow(id, { isAdmin: true });

    expect(result.status).toBe("NO_SHOW");
  });
});
