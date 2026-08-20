import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// 独立临时 DB；先设 env 再动态 import（lib/db 模块级单例读 env）
const TEST_DB = path.resolve(`./data/test-auto-invoice-${process.pid}-${Date.now()}.db`);
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
  createdAt integer,
  processedAt integer
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
`;

const PLANS = [
  { id: "plan-flex", name: "灵活工位", planType: "FLEX_DESK", monthlyFeeCents: 49900, freeFlexHours: 30 },
  { id: "plan-fixed", name: "固定工位", planType: "FIXED_DESK", monthlyFeeCents: 89900, freeFlexHours: 0 },
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
  await client.execute("DELETE FROM invoice_line_item");
  await client.execute("DELETE FROM invoice");
  await client.execute("DELETE FROM usage_record");
  await client.execute("DELETE FROM subscription");
  await client.execute("DELETE FROM outbox_event");
  await client.execute("DELETE FROM notification");
});

afterAll(async () => {
  await client.close();
  try { fs.unlinkSync(TEST_DB); } catch { /* ignore */ }
});

// 动态 import：确保 lib/db 读到测试 env
const { changeSubscription } = await import("../../membership/application/membership-app");
const billing = await import("./billing-app");
const { dispatchOutboxEvents } = await import("@/shared/outbox");
const { registerBillingSubscribers } = await import("./billing-subscribers");
const { registerNotificationSubscribers } = await import("../../notification/application/notification-subscribers");

// 注册事件订阅者（Billing 记录会员费 / Notification 发通知）
registerBillingSubscribers();
registerNotificationSubscribers();

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function seedUsage(chargeType: string, description: string, amountCents: number, referenceId: string) {
  await testDb.insert(schema.usageRecords).values({
    id: randomUUID(),
    memberId,
    chargeType: chargeType as never,
    description,
    referenceId,
    durationMs: 0,
    unitRateCents: 0,
    amountCents,
    occurredAt: new Date(),
    billingMonth: currentMonth(),
  }).run();
}

describe("generateMonthlyInvoice — 自动出账", () => {
  it("无账单时生成账单，明细行每条消费明细一行（不聚合）", async () => {
    // 直接构造消费明细：会员费 + 会议室 + 会议室（两次，应显示两行）
    await seedUsage("MEMBERSHIP_FEE", "FLEX_DESK 套餐月费", 49900, "sub-2026-08-m1");
    await seedUsage("ROOM_USAGE", "会议室使用费 ¥30/时", 3000, "room-1");
    await seedUsage("ROOM_USAGE", "会议室使用费 ¥30/时", 3000, "room-2");

    const inv = await billing.generateMonthlyInvoice(memberId, currentMonth());

    expect(inv.totalCents).toBe(55900); // 49900 + 3000 + 3000
    // 明细行不聚合：三次消费 = 三行
    expect(inv.lineItems).toHaveLength(3);
    const roomRows = inv.lineItems.filter((l) => l.chargeType === "ROOM_USAGE");
    expect(roomRows).toHaveLength(2);
    expect(roomRows.reduce((s, l) => s + l.amountCents, 0)).toBe(6000);
  });

  it("已有账单时追加未入账消费明细（升级差价），总额按原折扣率更新", async () => {
    // 首次订阅 FLEX + 出账（¥499）
    await changeSubscription({ memberId, planId: "plan-flex" });
    await dispatchOutboxEvents();
    await billing.generateMonthlyInvoice(memberId, currentMonth());

    // 升级 FIXED（差价 ¥400）→ 冲刷事件写入差价
    await changeSubscription({ memberId, planId: "plan-fixed" });
    await dispatchOutboxEvents();

    // 再次出账：应追加差价行，不重复基础费
    const inv = await billing.generateMonthlyInvoice(memberId, currentMonth());

    expect(inv.totalCents).toBe(89900); // 49900 + 40000
    const feeRows = inv.lineItems.filter((l) => l.chargeType === "MEMBERSHIP_FEE");
    expect(feeRows.reduce((s, l) => s + l.amountCents, 0)).toBe(89900);
    // 包含差价描述行
    expect(feeRows.some((l) => l.description.includes("升级差价"))).toBe(true);
  });

  it("历史账单（明细行无 referenceId）升级后不重复追加基础费", async () => {
    // 订阅 FLEX（写基础费 ¥499）→ 出账
    await changeSubscription({ memberId, planId: "plan-flex" });
    await dispatchOutboxEvents();
    await billing.generateMonthlyInvoice(memberId, currentMonth());
    // 模拟历史数据：清空 line items referenceId
    await client.execute("UPDATE invoice_line_item SET referenceId = NULL");

    // 升级 FIXED（差价 ¥400）
    await changeSubscription({ memberId, planId: "plan-fixed" });
    await dispatchOutboxEvents();

    const inv = await billing.generateMonthlyInvoice(memberId, currentMonth());

    // 只追加差价，不重复基础费
    expect(inv.totalCents).toBe(89900);
    const feeRows = inv.lineItems.filter((l) => l.chargeType === "MEMBERSHIP_FEE");
    expect(feeRows.reduce((s, l) => s + l.amountCents, 0)).toBe(89900);
    expect(feeRows.some((l) => l.description.includes("升级差价"))).toBe(true);
  });

  it("FLEX_USAGE 超过月费 120% 时封顶并按比例分摊到每条明细", async () => {
    await seedUsage("MEMBERSHIP_FEE", "FLEX_DESK 套餐月费", 49900, "sub-2026-08-m1");
    // 两条灵活区费用，总 ¥1200 远超 cap ¥598.8
    await seedUsage("FLEX_USAGE", "灵活区使用费", 60000, "flex-1");
    await seedUsage("FLEX_USAGE", "灵活区使用费", 60000, "flex-2");

    const inv = await billing.generateMonthlyInvoice(memberId, currentMonth());

    const flexRows = inv.lineItems.filter((l) => l.chargeType === "FLEX_USAGE");
    const flexTotal = flexRows.reduce((s, l) => s + l.amountCents, 0);
    expect(flexTotal).toBe(59880); // cap = round(49900 * 1.2)
    expect(inv.totalCents).toBe(49900 + 59880);
  });

  it("已支付账单不追加差价，差价生成新的独立账单", async () => {
    // 订阅 FLEX → 出账 ¥499 → 支付（PAID）
    await changeSubscription({ memberId, planId: "plan-flex" });
    await billing.ensureMonthlyInvoice(memberId);
    const first = await billing.listMyInvoices(memberId);
    expect(first).toHaveLength(1);
    await billing.processPayment(first[0].id, memberId);

    // 升级 FIXED（差价 ¥400）→ 出账：不应追加到已支付账单，应生成新账单
    await changeSubscription({ memberId, planId: "plan-fixed" });
    const inv = await billing.ensureMonthlyInvoice(memberId);

    const all = await billing.listMyInvoices(memberId);
    expect(all).toHaveLength(2);
    const paid = all.find((i) => i.status === "PAID");
    const pending = all.find((i) => i.status === "PENDING");
    expect(paid?.totalCents).toBe(49900); // 已支付账单保持 ¥499，不被追加
    expect(pending?.totalCents).toBe(40000); // 差价是独立账单 ¥400
    expect(inv.id).toBe(pending?.id);
    // 新账单只含差价，不含已入账的基础费
    const feeRows = pending?.lineItems.filter((l) => l.chargeType === "MEMBERSHIP_FEE") ?? [];
    expect(feeRows.reduce((s, l) => s + l.amountCents, 0)).toBe(40000);
    expect(feeRows.some((l) => l.description.includes("升级差价"))).toBe(true);

    // 统计：待支付 = 差价，已支付 = 基础费
    expect(await billing.getOutstandingBalance(memberId)).toBe(40000);
    expect(await billing.getPaidTotal(memberId)).toBe(49900);
  });

  it("追加差价到已有账单时也发布 InvoiceIssued 事件（通知）", async () => {
    // 订阅 FLEX → 出账（生成新账单，发布事件）
    await changeSubscription({ memberId, planId: "plan-flex" });
    await billing.ensureMonthlyInvoice(memberId);
    // 冲刷事件（模拟 dispatchOutboxEvents 消费）
    await dispatchOutboxEvents();

    // 升级 FIXED → 出账（追加差价到已有账单）
    await changeSubscription({ memberId, planId: "plan-fixed" });
    await billing.ensureMonthlyInvoice(memberId);

    // 追加后应发布 InvoiceIssued 事件（供 Notification 消费）
    const events = await testDb.select().from(schema.outboxEvents).all();
    const issued = events.filter((e) => e.eventType === "billing.invoice-issued");
    expect(issued.length).toBeGreaterThanOrEqual(2); // 生成 + 追加各一次
    const last = issued[issued.length - 1];
    const payload = JSON.parse(last.payload) as { totalCents: number };
    expect(payload.totalCents).toBe(89900); // 追加后的总额
  });

  it("出账后 invoice-issued 事件立即被消费并生成通知（不滞留 PENDING）", async () => {
    await changeSubscription({ memberId, planId: "plan-flex" });
    const inv = await billing.ensureMonthlyInvoice(memberId);

    // 事件应已被消费（PROCESSED），而非滞留 PENDING
    const events = await testDb.select().from(schema.outboxEvents).all();
    const issued = events.filter((e) => e.eventType === "billing.invoice-issued");
    expect(issued).toHaveLength(1);
    expect(issued[0].status).toBe("PROCESSED");

    // 通知应已生成
    const notifs = await testDb.select().from(schema.notifications).all();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].content).toContain("499.00");
    expect(notifs[0].memberId).toBe(memberId);
  });
});

describe("ensureMonthlyInvoice — 订阅/升级后自动出账", () => {
  it("冲刷待处理事件并生成账单", async () => {
    // 只订阅，不手动冲刷事件
    await changeSubscription({ memberId, planId: "plan-flex" });

    const inv = await billing.ensureMonthlyInvoice(memberId);

    expect(inv.billingMonth).toBe(currentMonth());
    expect(inv.totalCents).toBe(49900);
    // 事件应已被冲刷（usage_records 有会员费）
    const usages = await testDb.select().from(schema.usageRecords).all();
    expect(usages.length).toBeGreaterThan(0);
    const fee = usages.find((u) => u.chargeType === "MEMBERSHIP_FEE");
    expect(fee?.amountCents).toBe(49900);
  });

  it("已有账单时追加差价并更新总额", async () => {
    await changeSubscription({ memberId, planId: "plan-flex" });
    await billing.ensureMonthlyInvoice(memberId);

    await changeSubscription({ memberId, planId: "plan-fixed" });
    const inv = await billing.ensureMonthlyInvoice(memberId);

    expect(inv.totalCents).toBe(89900);
    const feeRows = inv.lineItems.filter((l) => l.chargeType === "MEMBERSHIP_FEE");
    expect(feeRows.reduce((s, l) => s + l.amountCents, 0)).toBe(89900);
    expect(feeRows.some((l) => l.description.includes("升级差价"))).toBe(true);
  });
});
