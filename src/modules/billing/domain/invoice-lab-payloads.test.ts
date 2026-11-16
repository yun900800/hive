import { describe, it, expect } from "vitest";
import {
  buildHivePayload,
  buildMinimalPayload,
  buildShopdemoPayload,
  buildLabPayload,
  compactMonth,
  kindNeedsInvoice,
  type LabInvoice,
  type LabMember,
} from "./invoice-lab-payloads";

const INVOICE: LabInvoice = {
  id: "3f8a1c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b",
  billingMonth: "2026-11",
  status: "PAID",
  discountAppliedCents: 5000,
  createdAt: "2026-11-01T00:00:00.000Z",
  dueDate: "2026-11-30T00:00:00.000Z",
  lineItems: [
    { description: "固定办公位月费", amountCents: 89900 },
    { description: "会议室使用（小时）", amountCents: 3000 },
  ],
};

const MEMBER: LabMember = { name: "张伟", email: "member@hive.test" };

describe("compactMonth", () => {
  it("把 YYYY-MM 压成 6 位数字", () => {
    expect(compactMonth("2026-11")).toBe("202611");
  });

  it("容忍已经压过的输入", () => {
    expect(compactMonth("202611")).toBe("202611");
  });
});

describe("buildHivePayload", () => {
  const payload = buildHivePayload(INVOICE, MEMBER, "test@example.com");

  it("发票 id 带 test- 前缀，避免污染审计表", () => {
    expect(payload.invoice.id.startsWith("test-")).toBe(true);
  });

  it("发票号可读且带 TEST 标识", () => {
    expect(payload.invoice.number).toBe("TEST-202611-3F8A");
  });

  it("沿用真实账单的金额与折扣", () => {
    expect(payload.invoice.discountAppliedCents).toBe(5000);
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].amountCents).toBe(89900);
  });

  it("数量恒为 1 —— 明细行没有数量字段", () => {
    expect(payload.items.every((item) => item.quantity === 1)).toBe(true);
  });

  it("收件邮箱来自参数而不是会员档案", () => {
    expect(payload.member.email).toBe("test@example.com");
    expect(payload.member.name).toBe("张伟");
  });
});

describe("buildMinimalPayload", () => {
  const payload = buildMinimalPayload(INVOICE, MEMBER, "test@example.com");

  it("只保留第一条明细", () => {
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].description).toBe("固定办公位月费");
  });

  it("故意不带发票号与折扣，用于验证兜底规则", () => {
    expect("number" in payload.invoice).toBe(false);
    expect("discountAppliedCents" in payload.invoice).toBe(false);
  });

  it("id 与 hive tab 不同，两个 tab 互不干扰去重", () => {
    expect(payload.invoice.id).not.toBe(buildHivePayload(INVOICE, MEMBER, "x@y.z").invoice.id);
  });
});

describe("buildShopdemoPayload", () => {
  const payload = buildShopdemoPayload("test@example.com");

  it("保留 Shopify 形态的字段路径", () => {
    expect(payload.order.line_items[0].tax_rate).toBe(0.08);
    expect(payload.order.financial_status).toBe("paid");
  });

  it("订单号与 id 带 TEST 标识", () => {
    expect(payload.order.id.startsWith("test-")).toBe(true);
    expect(payload.order.name.startsWith("TEST-")).toBe(true);
  });

  it("只替换邮箱", () => {
    expect(payload.order.email).toBe("test@example.com");
    expect(payload.order.customer.name).toBe("John Doe");
  });
});

describe("buildLabPayload", () => {
  it("resend 为真时在顶层追加标记", () => {
    const payload = buildLabPayload("hive", { invoice: INVOICE, member: MEMBER }, "a@b.co", true);
    expect(payload.resend).toBe(true);
  });

  it("resend 为假时不出现该字段", () => {
    const payload = buildLabPayload("hive", { invoice: INVOICE, member: MEMBER }, "a@b.co", false);
    expect("resend" in payload).toBe(false);
  });

  it("shopdemo 不依赖账单数据", () => {
    const payload = buildLabPayload("shopdemo", { invoice: null, member: MEMBER }, "a@b.co", false);
    expect(payload.client).toBe("shopdemo");
  });

  it("没有账单时 hive tab 明确报错，而不是发出空发票", () => {
    expect(() =>
      buildLabPayload("hive", { invoice: null, member: MEMBER }, "a@b.co", false),
    ).toThrow(/没有可用账单/);
  });
});

describe("kindNeedsInvoice", () => {
  it("只有 shopdemo 不依赖真实账单", () => {
    expect(kindNeedsInvoice("hive")).toBe(true);
    expect(kindNeedsInvoice("minimal")).toBe(true);
    expect(kindNeedsInvoice("shopdemo")).toBe(false);
  });
});
