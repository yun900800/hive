import { z } from "zod";

/**
 * 环境变量校验 —— 启动即失败，而不是运行时才暴露。
 *
 * 背景：`lib/db` 原先在缺少 DATABASE_URL 时会静默回落到 `./data/hive.db`。
 * 在 Vercel 上这等于"写本地只读磁盘"，表现为登录失败/数据消失，极难排查。
 *
 * 注意：`next build` 阶段也会加载本模块，而构建环境不一定注入运行时密钥，
 * 因此用 NEXT_PHASE 跳过构建期强校验，把错误留到首请求。
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_AUTH_TOKEN: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`环境变量格式错误：${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (isProduction && !isBuildPhase) {
  const missing: string[] = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.AUTH_SECRET) missing.push("AUTH_SECRET");

  if (missing.length > 0) {
    throw new Error(`生产环境缺少必需的环境变量：${missing.join(", ")}`);
  }

  // 定时任务密钥缺失不会让应用崩溃，但会让 /api/outbox/dispatch 与月度出账
  // 静默返回 403 —— 必须在日志里喊出来。
  if (!env.CRON_SECRET) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "env.cron-secret-missing",
        message: "CRON_SECRET 未配置，定时出账与事件冲刷将返回 403",
        at: new Date().toISOString(),
      })
    );
  }
}

export { env, isProduction };
