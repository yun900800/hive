import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * Auth tables — align with @auth/drizzle-adapter (DefaultSQLiteSchema).
 * The users table extends the adapter contract with:
 * - passwordHash: password-based (Credentials) sign-in
 * - role: MEMBER | ADMIN (admin vs member authorization)
 */
export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  // --- custom fields (not part of the Auth.js adapter) ---
  passwordHash: text("passwordHash"),
  role: text("role", { enum: ["MEMBER", "ADMIN"] }).default("MEMBER").notNull(),
  memberId: text("memberId"),
  // Bumped whenever role/memberId changes. JWTs carry the value they were issued
  // with; a mismatch invalidates the session so demotions take effect immediately
  // instead of waiting for the token to expire.
  sessionVersion: integer("sessionVersion").default(0).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (verificationToken) => ({
    pk: primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
  })
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
