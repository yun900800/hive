import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client for SQLite via libsql (development / Turso in production).
 * A missing DATABASE_URL in production must fail loudly — silently falling back
 * to a local file made "database is empty" bugs invisible on Vercel.
 */
function resolveSqliteUrl(url: string): string {
  if (/^(file|sqlite|http|libsql):/.test(url)) return url;
  return `file:${path.resolve(url)}`;
}

// 构建期的 page data 收集阶段没有运行时密钥，允许回落到本地文件；
// 真正的运行时（Vercel）必须显式配置 DATABASE_URL，否则立刻失败。
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const localFallback =
  env.NODE_ENV === "production" && !isBuildPhase ? "" : "./data/hive.db";
const rawUrl = env.DATABASE_URL ?? localFallback;
if (!rawUrl) {
  throw new Error("DATABASE_URL 未配置：生产环境必须指向 Turso/Postgres");
}

const client = createClient({
  url: resolveSqliteUrl(rawUrl),
  authToken: env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

export type Db = typeof db;
