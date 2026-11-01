import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

// 独立临时 DB；先设 env 再动态 import（lib/db 模块级单例读 env）
const TEST_DB = path.resolve(`./data/test-facility-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

const client = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(client, { schema });

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS flex_zone (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  floor text NOT NULL,
  capacity integer NOT NULL,
  openingTime text DEFAULT '08:00' NOT NULL,
  closingTime text DEFAULT '22:00' NOT NULL,
  status text DEFAULT 'OPEN' NOT NULL,
  createdAt integer,
  updatedAt integer
);

CREATE TABLE IF NOT EXISTS gate (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  floor text NOT NULL,
  zone text NOT NULL,
  type text DEFAULT 'ENTRY_TURNSTILE' NOT NULL,
  status text DEFAULT 'OPERATIONAL' NOT NULL,
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
`;

beforeAll(async () => {
  await client.executeMultiple(CREATE_TABLES);
});

beforeEach(async () => {
  await client.execute("DELETE FROM flex_zone");
  await client.execute("DELETE FROM gate");
  await client.execute("DELETE FROM flex_session");
});

afterAll(async () => {
  await client.close();
  try {
    fs.unlinkSync(TEST_DB);
  } catch {
    /* ignore */
  }
});

const facility = await import("./facility-app");

const ZONE_INPUT = {
  name: "C区灵活办公区",
  floor: "C",
  capacity: 20,
  openingTime: "08:00",
  closingTime: "22:00",
};

async function seedActiveSession(zoneId: string, status = "ACTIVE") {
  await testDb
    .insert(schema.flexSessions)
    .values({
      id: randomUUID(),
      memberId: randomUUID(),
      zoneId,
      checkInAt: new Date(),
      status: status as "ACTIVE" | "COMPLETED",
    })
    .run();
}

describe("灵活区管理", () => {
  it("新增灵活区：状态为 OPEN，字段落库", async () => {
    const created = await facility.createFlexZone(ZONE_INPUT);

    expect(created?.status).toBe("OPEN");
    expect(created?.name).toBe(ZONE_INPUT.name);
    expect(created?.floor).toBe("C");
    expect(created?.capacity).toBe(20);
    expect(created?.openingTime).toBe("08:00");
    expect(created?.closingTime).toBe("22:00");

    const all = await facility.listFlexZones();
    expect(all).toHaveLength(1);
  });

  it("有会员正在使用（ACTIVE 会话）时拒绝删除", async () => {
    const zone = await facility.createFlexZone(ZONE_INPUT);
    await seedActiveSession(zone!.id);

    await expect(facility.deleteFlexZone(zone!.id)).rejects.toThrow(
      "该灵活区还有会员在使用，请先办理离场"
    );

    const row = await testDb
      .select()
      .from(schema.flexZones)
      .where(eq(schema.flexZones.id, zone!.id))
      .get();
    expect(row).toBeDefined();
  });

  it("已离场（COMPLETED 会话）后可以删除", async () => {
    const zone = await facility.createFlexZone(ZONE_INPUT);
    await seedActiveSession(zone!.id, "COMPLETED");

    await facility.deleteFlexZone(zone!.id);

    expect(await facility.listFlexZones()).toHaveLength(0);
  });

  it("无任何会话时直接删除", async () => {
    const zone = await facility.createFlexZone(ZONE_INPUT);

    await facility.deleteFlexZone(zone!.id);

    expect(await facility.listFlexZones()).toHaveLength(0);
  });
});

describe("闸机管理", () => {
  const GATE_INPUT = {
    name: "东区入口2号闸机",
    floor: "A",
    zone: "entrance",
    type: "ENTRY_TURNSTILE" as const,
  };

  it("新增闸机：状态为 OPERATIONAL，字段落库", async () => {
    const created = await facility.createGate(GATE_INPUT);

    expect(created?.status).toBe("OPERATIONAL");
    expect(created?.name).toBe(GATE_INPUT.name);
    expect(created?.floor).toBe("A");
    expect(created?.zone).toBe("entrance");
    expect(created?.type).toBe("ENTRY_TURNSTILE");

    const all = await facility.listGates();
    expect(all).toHaveLength(1);
  });

  it("删除闸机后从列表移除", async () => {
    const gate = await facility.createGate(GATE_INPUT);

    await facility.deleteGate(gate!.id);

    expect(await facility.listGates()).toHaveLength(0);
  });
});
