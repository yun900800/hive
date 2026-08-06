/**
 * 授权守卫单测 —— mock @/auth 会话，验证角色/登录分支。
 * 覆盖：isAdmin / isAuthenticated / getSessionMemberId / requireAdmin / requireMember / guardError 两变体。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import {
  isAdmin,
  isAuthenticated,
  getSessionMemberId,
  requireAdmin,
  requireMember,
  adminGuardError,
  memberGuardError,
} from "@/lib/auth-guards";

const mockAuth = vi.mocked(auth);

beforeEach(() => {
  mockAuth.mockReset();
});

const adminSession = { user: { role: "ADMIN" as const, memberId: "m-admin" } };
const memberSession = { user: { role: "MEMBER" as const, memberId: "m-user" } };
const loggedInNoMember = { user: { role: "MEMBER" as const, memberId: null } };

describe("isAdmin / isAuthenticated / getSessionMemberId", () => {
  it("管理员会话 isAdmin=true", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    expect(await isAdmin()).toBe(true);
    expect(await isAuthenticated()).toBe(true);
    expect(await getSessionMemberId()).toBe("m-admin");
  });

  it("普通会员 isAdmin=false，但已认证且有 memberId", async () => {
    mockAuth.mockResolvedValue(memberSession as never);
    expect(await isAdmin()).toBe(false);
    expect(await isAuthenticated()).toBe(true);
    expect(await getSessionMemberId()).toBe("m-user");
  });

  it("未登录全部为 false / null", async () => {
    mockAuth.mockResolvedValue(null as never);
    expect(await isAdmin()).toBe(false);
    expect(await isAuthenticated()).toBe(false);
    expect(await getSessionMemberId()).toBeNull();
  });

  it("auth 抛错（无请求上下文）按未登录处理", async () => {
    mockAuth.mockRejectedValue(new Error("outside request scope"));
    expect(await isAdmin()).toBe(false);
    expect(await isAuthenticated()).toBe(false);
    expect(await getSessionMemberId()).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("管理员放行", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it("普通会员拒绝", async () => {
    mockAuth.mockResolvedValue(memberSession as never);
    await expect(requireAdmin()).rejects.toThrow("管理员权限");
  });

  it("未登录拒绝", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(requireAdmin()).rejects.toThrow("管理员权限");
  });
});

describe("requireMember", () => {
  it("普通会员放行并返回 memberId", async () => {
    mockAuth.mockResolvedValue(memberSession as never);
    await expect(requireMember()).resolves.toBe("m-user");
  });

  it("管理员也有 memberId 时可作为会员通过", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    await expect(requireMember()).resolves.toBe("m-admin");
  });

  it("已登录但无 memberId 拒绝", async () => {
    mockAuth.mockResolvedValue(loggedInNoMember as never);
    await expect(requireMember()).rejects.toThrow("登录");
  });

  it("未登录拒绝", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(requireMember()).rejects.toThrow("登录");
  });
});

describe("guardError 变体", () => {
  it("adminGuardError 管理员返回 null", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    expect(await adminGuardError()).toBeNull();
  });

  it("adminGuardError 普通会员返回错误文案", async () => {
    mockAuth.mockResolvedValue(memberSession as never);
    const err = await adminGuardError();
    expect(err).toBeTruthy();
    expect(err).toContain("管理员");
  });

  it("memberGuardError 未登录返回登录文案", async () => {
    mockAuth.mockResolvedValue(null as never);
    const err = await memberGuardError();
    expect(err).toBeTruthy();
    expect(err).toContain("登录");
  });
});
