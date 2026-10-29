import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// 独立临时 DB，避免污染开发库；先设 env 再动态 import（lib/db 模块级单例读 env）
// 随机文件名避免上次运行残留导致唯一约束冲突
const TEST_DB = path.resolve(`./data/test-change-sub-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${TEST_DB}`;

const client = createClient({ url: `file:${TEST_DB}` });
const testDb = drizzle(client, { schema });

// 建表（仅本测试需要的表）
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
`;

// 套餐种子（与 seed/data.ts 价格一致）
const PLANS = [
  { id: "plan-flex", name: "灵活工位", planType: "FLEX_DESK", monthlyFeeCents: 49900, freeFlexHours: 30 },
  { id: "plan-fixed", name: "固定工位", planType: "FIXED_DESK", monthlyFeeCents: 89900, freeFlexHours: 0 },
  { id: "plan-virtual", name: "虚拟办公", planType: "VIRTUAL", monthlyFeeCents: 19900, freeFlexHours: 0 },
] as const;

let memberId: string;

beforeAll(async () => {
  await client.executeMultiple(CREATE_TABLES);
  for (const p of PLANS) {
    await testDb.insert(schema.plans).values({ ...p, isActive: true }).run();
  }
  memberId = randomUUID();
  await testDb.insert(schema.members).values({
    id: memberId,
    name: "测试会员",
    email: `test-${randomUUID()}@example.com`,
    tier: "BASIC",
    creditScore: 100,
  }).run();
});

beforeEach(async () => {
  await client.execute("DELETE FROM subscription");
  await client.execute("DELETE FROM outbox_event");
});

afterAll(async () => {
  await client.close();
  try { fs.unlinkSync(TEST_DB); } catch { /* ignore */ }
});

// 动态 import：确保 lib/db 读到测试 env
const { changeSubscription } = await import("./membership-app");

describe("changeSubscription", () => {
  it("无生效订阅时走首次订阅（SUBSCRIBE）", async () => {
    const r = await changeSubscription({ memberId, planId: "plan-flex" });
    expect(r.changeType).toBe("SUBSCRIBE");
    expect(r.subscription.status).toBe("ACTIVE");
    expect(r.subscription.planType).toBe("FLEX_DESK");
    const subs = await testDb.select().from(schema.subscriptions).all();
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe("ACTIVE");
  });

  it("升级：旧订阅 CANCELLED、新订阅 ACTIVE、差价正确、事件写入", async () => {
    await changeSubscription({ memberId, planId: "plan-flex" });
    const r = await changeSubscription({ memberId, planId: "plan-fixed" });
    expect(r.changeType).toBe("UPGRADE");
    expect(r.diffCents).toBe(40000);
    const subs = await testDb.select().from(schema.subscriptions).all();
    expect(subs).toHaveLength(2);
    const active = subs.filter((s) => s.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].planType).toBe("FIXED_DESK");
    const cancelled = subs.filter((s) => s.status === "CANCELLED");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].planType).toBe("FLEX_DESK");
    const events = await testDb.select().from(schema.outboxEvents).all();
    expect(events).toHaveLength(2); // 首次订阅 + 升级
    const upgradeEvent = events.find((e) => e.eventType === "membership.subscription-upgraded");
    expect(upgradeEvent).toBeDefined();
    const payload = JSON.parse(upgradeEvent!.payload);
    expect(payload.diffCents).toBe(40000);
    expect(payload.oldPlanType).toBe("FLEX_DESK");
    expect(payload.oldMonthlyFeeCents).toBe(49900);
  });

  it("降级：旧订阅 CANCELLED、新订阅 ACTIVE、事件写入 downgraded", async () => {
    await changeSubscription({ memberId, planId: "plan-fixed" });
    const r = await changeSubscription({ memberId, planId: "plan-virtual" });
    expect(r.changeType).toBe("DOWNGRADE");
    expect(r.diffCents).toBe(-70000);
    const subs = await testDb.select().from(schema.subscriptions).all();
    const active = subs.filter((s) => s.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].planType).toBe("VIRTUAL");
    const events = await testDb.select().from(schema.outboxEvents).all();
    const downgradeEvent = events.find((e) => e.eventType === "membership.subscription-downgraded");
    expect(downgradeEvent).toBeDefined();
    const payload = JSON.parse(downgradeEvent!.payload);
    expect(payload.oldMonthlyFeeCents).toBe(89900);
    expect(payload.oldPlanType).toBe("FIXED_DESK");
  });

  it("平级：事件写入 downgraded（SAME）", async () => {
    // 先建一个同价套餐
    await testDb.insert(schema.plans).values({
      id: "plan-fixed-2",
      name: "固定工位 B",
      planType: "FIXED_DESK",
      monthlyFeeCents: 89900,
      freeFlexHours: 0,
      isActive: true,
    }).run();
    await changeSubscription({ memberId, planId: "plan-fixed" });
    const r = await changeSubscription({ memberId, planId: "plan-fixed-2" });
    expect(r.changeType).toBe("SAME");
    expect(r.diffCents).toBe(0);
    const events = await testDb.select().from(schema.outboxEvents).all();
    const downgradeEvent = events.find((e) => e.eventType === "membership.subscription-downgraded");
    expect(downgradeEvent).toBeDefined();
  });

  it("切换后同一会员只有一条 ACTIVE", async () => {
    await changeSubscription({ memberId, planId: "plan-flex" });
    await changeSubscription({ memberId, planId: "plan-fixed" });
    await changeSubscription({ memberId, planId: "plan-virtual" });
    const subs = await testDb.select().from(schema.subscriptions).all();
    expect(subs).toHaveLength(3);
    const active = subs.filter((s) => s.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].planType).toBe("VIRTUAL");
  });
});
