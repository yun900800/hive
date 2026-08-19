import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import {
  CHARGE_TYPES,
  INVOICE_STATUSES,
  type ChargeType,
  type InvoiceStatus,
} from "../../domain/types";

/** usage_records — 使用记录（事件驱动计费的原始素材） */
export const usageRecords = sqliteTable(
  "usage_record",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId").notNull(),
    chargeType: text("chargeType", { enum: CHARGE_TYPES })
      .$type<ChargeType>()
      .notNull(),
    description: text("description").notNull(),
    referenceId: text("referenceId").notNull(), // 关联 booking/session/subscription id
    durationMs: integer("durationMs").default(0).notNull(),
    unitRateCents: integer("unitRateCents").default(0).notNull(),
    amountCents: integer("amountCents").notNull(),
    occurredAt: integer("occurredAt", { mode: "timestamp_ms" }).notNull(),
    billingMonth: text("billingMonth").notNull(), // "YYYY-MM" 冗余，便于月度聚合
  },
  (table) => [
    index("usage_record_member_idx").on(table.memberId),
    index("usage_record_month_idx").on(table.memberId, table.billingMonth),
    uniqueIndex("usage_record_ref_idx").on(table.chargeType, table.referenceId),
  ]
);

/** invoices — 账单（Billing 聚合根，一个会员每月一张） */
export const invoices = sqliteTable(
  "invoice",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId").notNull(),
    billingMonth: text("billingMonth").notNull(),
    totalCents: integer("totalCents").notNull(),
    discountRate: integer("discountRate").default(100).notNull(), // 万分比：10000 = 1.0
    discountAppliedCents: integer("discountAppliedCents").default(0).notNull(),
    paidAmountCents: integer("paidAmountCents").default(0).notNull(),
    status: text("status", { enum: INVOICE_STATUSES })
      .$type<InvoiceStatus>()
      .default("PENDING")
      .notNull(),
    dueDate: integer("dueDate", { mode: "timestamp_ms" }).notNull(),
    paidAt: integer("paidAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("invoice_member_idx").on(table.memberId),
    uniqueIndex("invoice_member_month_idx").on(table.memberId, table.billingMonth),
  ]
);

/** invoice_line_items — 账单明细行（Invoice 聚合的子实体；每行对应一条消费明细 usage_record） */
export const invoiceLineItems = sqliteTable(
  "invoice_line_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoiceId")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    chargeType: text("chargeType", { enum: CHARGE_TYPES })
      .$type<ChargeType>()
      .notNull(),
    description: text("description").notNull(),
    amountCents: integer("amountCents").notNull(),
    referenceId: text("referenceId"), // 关联 usage_record.referenceId，用于追加未入账消费明细
  },
  (table) => [index("invoice_line_invoice_idx").on(table.invoiceId)]
);

export type UsageRecordRow = typeof usageRecords.$inferSelect;
export type NewUsageRecordRow = typeof usageRecords.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
export type InvoiceLineItemRow = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItemRow = typeof invoiceLineItems.$inferInsert;
