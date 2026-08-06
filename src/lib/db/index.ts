import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Drizzle client for SQLite via libsql (development).
 * Production will swap to `drizzle-orm/node-postgres` with the same schema.
 */
function resolveSqliteUrl(url: string): string {
  if (/^(file|sqlite|http|libsql):/.test(url)) return url;
  return `file:${path.resolve(url)}`;
}

const rawUrl = process.env.DATABASE_URL ?? "./data/hive.db";
const client = createClient({ url: resolveSqliteUrl(rawUrl) });

export const db = drizzle(client, { schema });

export type Db = typeof db;
