import { db } from "@/lib/db";
import { getSessionMemberId } from "@/lib/auth-guards";
import {
  invoices,
  invoiceLineItems,
  type InvoiceLineItemRow,
  type InvoiceRow,
} from "@/modules/billing/infrastructure/db/schema";
import { members } from "@/modules/membership/infrastructure/db/schema";
import type { LabInvoice, LabSource } from "@/modules/billing/domain/invoice-lab-payloads";

/**
 * 联调台的数据来源。
 *
 * 优先用「当前登录账号自己的最近一张账单」；管理员账号通常没有 memberId，
 * 此时退回全库最近一张，并把选中的会员显示在页面上 —— 不让人猜自己在测谁的账。
 */
export async function loadLabSource(): Promise<LabSource> {
  const memberId = await getSessionMemberId();

  const [invoiceRows, lineRows, memberRows] = await Promise.all([
    db.select().from(invoices).all(),
    db.select().from(invoiceLineItems).all(),
    db.select().from(members).all(),
  ]);

  const ordered = [...invoiceRows].sort(byCreatedAtDesc);
  const own = memberId ? ordered.find((row) => row.memberId === memberId) : undefined;
  const row = own ?? ordered[0];

  if (!row) {
    return { invoice: null, member: { name: "", email: "" } };
  }

  const memberRow = memberRows.find((item) => item.id === row.memberId);
  return {
    invoice: toLabInvoice(row, lineRows.filter((line) => line.invoiceId === row.id)),
    member: { name: memberRow?.name ?? "", email: memberRow?.email ?? "" },
  };
}

function byCreatedAtDesc(a: InvoiceRow, b: InvoiceRow): number {
  return toMillis(b.createdAt) - toMillis(a.createdAt);
}

function toMillis(value: Date | null): number {
  return value ? value.getTime() : 0;
}

function toIso(value: Date | null): string {
  return (value ?? new Date()).toISOString();
}

function toLabInvoice(row: InvoiceRow, lines: InvoiceLineItemRow[]): LabInvoice {
  return {
    id: row.id,
    billingMonth: row.billingMonth,
    status: row.status,
    discountAppliedCents: row.discountAppliedCents ?? 0,
    createdAt: toIso(row.createdAt),
    dueDate: toIso(row.dueDate),
    lineItems: lines.map((line) => ({
      description: line.description,
      amountCents: line.amountCents,
    })),
  };
}
