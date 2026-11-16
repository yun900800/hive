/**
 * 发票联调台的测试载荷构造 —— 纯函数，无框架、无 IO。
 *
 * 为什么放在 domain：
 *  - 客户端要用它做「所见即所发」的实时预览，服务端要用它生成真正发出的载荷。
 *    两边必须调用同一个函数，否则预览会骗人。
 *  - 纯函数可以直接单元测试，不需要起 Next 或数据库。
 *
 * 测试载荷的两条约定：
 *  1. 发票 id 一律加 `test-` 前缀 —— 审计表（Google Sheet）是去重的唯一事实来源，
 *     用真实 id 会把测试行伪装成真实发送，并挡住真实发票的重发。
 *  2. 只有 `shopdemo` 是静态数据：货币、税率、客户在 hive 的账单里都不存在，派生不出来。
 */

export const LAB_KINDS = ["hive", "minimal", "shopdemo"] as const;
export type LabKind = (typeof LAB_KINDS)[number];

/** 账单视图（只取构造载荷需要的字段） */
export type LabInvoice = {
  id: string;
  billingMonth: string; // "YYYY-MM"
  status: string;
  discountAppliedCents: number;
  createdAt: string; // ISO
  dueDate: string; // ISO
  lineItems: Array<{ description: string; amountCents: number }>;
};

export type LabMember = { name: string; email: string };

export type LabSource = {
  invoice: LabInvoice | null;
  member: LabMember;
};

/** 测试发票 id 前缀 —— 审计表里一眼可辨，且不会与真实 id 相撞 */
export const TEST_ID_PREFIX = "test-";

/** "2026-11" → "202611"（n8n 侧按 6 位数字切月份派生发票号） */
export function compactMonth(billingMonth: string): string {
  return billingMonth.replace(/[^0-9]/g, "").slice(0, 6);
}

/** 由账单 id 派生一个可读的测试发票号 */
function testInvoiceNumber(billingMonth: string, invoiceId: string): string {
  const suffix = invoiceId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `TEST-${compactMonth(billingMonth)}-${suffix}`;
}

/**
 * Hive 真实账单：整张发票原样送进工作流。
 *
 * `quantity` 固定为 1：InvoiceLineItem 没有数量字段，每行本身就是一笔汇总金额，
 * 因此 PDF 的「数量」列恒为 1、「单价」等于「金额」。
 */
export function buildHivePayload(invoice: LabInvoice, member: LabMember, email: string) {
  return {
    client: "hive",
    billingMonth: compactMonth(invoice.billingMonth),
    invoice: {
      id: `${TEST_ID_PREFIX}${invoice.id}`,
      number: testInvoiceNumber(invoice.billingMonth, invoice.id),
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      status: invoice.status,
      discountAppliedCents: invoice.discountAppliedCents,
    },
    member: { name: member.name, email },
    items: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: 1,
      amountCents: item.amountCents,
    })),
  };
}

/**
 * 最小数据：同一张真实账单，只取第一条明细、不带折扣、不带发票号。
 * 故意留空 `invoice.number`，用来验证工作流的三级回退规则。
 */
export function buildMinimalPayload(invoice: LabInvoice, member: LabMember, email: string) {
  const first = invoice.lineItems[0] ?? { description: "服务费", amountCents: 10000 };
  return {
    client: "hive",
    billingMonth: compactMonth(invoice.billingMonth),
    invoice: {
      id: `${TEST_ID_PREFIX}min-${invoice.id}`,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
    },
    member: { name: member.name, email },
    items: [{ description: first.description, quantity: 1, amountCents: first.amountCents }],
  };
}

/**
 * 其他发票：类 Shopify 订单，USD、8% 单行税、已支付。
 * 与 `docs/n8n/examples/shopdemo-payload.json` 同构，仅 id / 单号 / 邮箱不同。
 */
export function buildShopdemoPayload(email: string) {
  return {
    client: "shopdemo",
    order: {
      id: `${TEST_ID_PREFIX}shopdemo-0001`,
      name: "TEST-ACME-1001",
      created_at: "2026-11-10T08:30:00Z",
      currency: "usd",
      email,
      financial_status: "paid",
      customer: { name: "John Doe" },
      line_items: [
        { title: "Canvas Tote Bag", quantity: 2, price: 24.5, tax_rate: 0.08 },
        { title: "Shipping", quantity: 1, price: 9.9, tax_rate: 0 },
      ],
    },
  };
}

/** 该 tab 是否依赖真实账单数据 */
export function kindNeedsInvoice(kind: LabKind): boolean {
  return kind !== "shopdemo";
}

/**
 * 统一入口。`resend` 为真时在顶层加 `resend: true`，
 * 工作流会走 revision+1 而不是返回 duplicate。
 */
export function buildLabPayload(
  kind: LabKind,
  source: LabSource,
  email: string,
  resend: boolean,
): Record<string, unknown> {
  const base = buildForKind(kind, source, email);
  return resend ? { ...base, resend: true } : base;
}

function buildForKind(kind: LabKind, source: LabSource, email: string): Record<string, unknown> {
  if (kind === "shopdemo") return buildShopdemoPayload(email);

  const { invoice, member } = source;
  if (!invoice) throw new Error("当前没有可用账单，无法构造该测试载荷");

  return kind === "hive"
    ? buildHivePayload(invoice, member, email)
    : buildMinimalPayload(invoice, member, email);
}

/** 载荷里被替换的邮箱位置，供预览高亮与自检 */
export function emailPathsOf(kind: LabKind): string[] {
  return kind === "shopdemo" ? ["order.email"] : ["member.email"];
}
