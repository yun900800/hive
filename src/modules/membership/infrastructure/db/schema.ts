import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import {
  MEMBER_TIERS,
  PLAN_TYPES,
  SUBSCRIPTION_STATUSES,
  type MemberTier,
  type PlanType,
  type SubscriptionStatus,
} from "../../domain/types";

/** members — 会员基本信息（Membership 聚合根） */
export const members = sqliteTable(
  "member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email").unique().notNull(),
    tier: text("tier", { enum: MEMBER_TIERS })
      .$type<MemberTier>()
      .default("BASIC")
      .notNull(),
    creditScore: integer("creditScore").default(100).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("member_email_idx").on(table.email)]
);

/** plans — 套餐目录（SubscriptionPlan 聚合：产品定义） */
export const plans = sqliteTable(
  "plan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    planType: text("planType", { enum: PLAN_TYPES })
      .$type<PlanType>()
      .notNull(),
    monthlyFeeCents: integer("monthlyFeeCents").notNull(),
    freeFlexHours: integer("freeFlexHours").default(0).notNull(),
    description: text("description"),
    isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [index("plan_type_idx").on(table.planType)]
);

/** subscriptions — 订阅记录（SubscriptionPlan 聚合：一个会员一个生效套餐） */
export const subscriptions = sqliteTable(
  "subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text("memberId")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    planId: text("planId")
      .notNull()
      .references(() => plans.id),
    planType: text("planType", { enum: PLAN_TYPES })
      .$type<PlanType>()
      .notNull(),
    monthlyFeeCents: integer("monthlyFeeCents").notNull(),
    startDate: integer("startDate", { mode: "timestamp_ms" }).notNull(),
    endDate: integer("endDate", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: SUBSCRIPTION_STATUSES })
      .$type<SubscriptionStatus>()
      .default("ACTIVE")
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("subscription_member_idx").on(table.memberId),
    index("subscription_status_idx").on(table.status),
  ]
);

export type MemberRow = typeof members.$inferSelect;
export type NewMemberRow = typeof members.$inferInsert;
export type PlanRow = typeof plans.$inferSelect;
export type NewPlanRow = typeof plans.$inferInsert;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
