import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/hive.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
    // drizzle-kit 0.31 类型定义未含 authToken（运行时支持 Turso），断言绕过
  } as { url: string; authToken?: string },
});
