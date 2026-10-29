import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * env.ts 在模块加载时校验环境变量，所以要靠动态 import + resetModules 触发。
 * 每个用例结束后恢复原始 env，避免污染其它测试文件。
 */
const ORIGINAL = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PHASE: process.env.NEXT_PHASE,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** @types/node 把 NODE_ENV 声明为 readonly，测试里需要临时覆盖 */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string>).NODE_ENV = value;
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
});

describe("env — 生产环境必须显式配置", () => {
  it("缺少 DATABASE_URL 时启动即失败", async () => {
    vi.resetModules();
    setNodeEnv("production");
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = "test-secret";

    await expect(import("./env")).rejects.toThrow(/DATABASE_URL/);
  });

  it("缺少 AUTH_SECRET 时启动即失败", async () => {
    vi.resetModules();
    setNodeEnv("production");
    process.env.DATABASE_URL = "file:./data/test.db";
    delete process.env.AUTH_SECRET;

    await expect(import("./env")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("生产构建阶段跳过强校验（构建机不一定注入运行时密钥）", async () => {
    vi.resetModules();
    setNodeEnv("production");
    process.env.NEXT_PHASE = "phase-production-build";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;

    const mod = await import("./env");
    expect(mod.isProduction).toBe(true);
  });

  it("开发环境允许本地 SQLite 回落", async () => {
    vi.resetModules();
    setNodeEnv("development");
    delete process.env.DATABASE_URL;

    const mod = await import("./env");
    expect(mod.env.DATABASE_URL).toBeUndefined();
  });
});
