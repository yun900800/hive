import { auth } from "@/auth";

/**
 * 授权守卫 —— Server Action / 页面统一入口。
 *
 * 为什么放在 lib？
 *  - Server Actions 是 HTTP 端点，页面级 redirect 挡不住直接构造的请求，
 *    必须在这层二次校验（尤其管理端 CRUD）。
 *  - 统一收口避免各模块手写 session 判断出现遗漏（如 facility.ts 之前的漏网）。
 */

/** 会话 user 结构（只取守卫关心的字段，避免依赖 NextAuth 复杂类型） */
type SessionUser = {
  user?: {
    role?: string | null;
    memberId?: string | null;
  } | null;
};

/**
 * 安全取会话：auth() 在非请求上下文（脚本/后台任务）会抛错，
 * 统一按「未登录」处理（fail-closed，不向调用方泄漏异常）。
 */
async function safeAuth(): Promise<SessionUser> {
  try {
    return (await auth()) as SessionUser;
  } catch {
    return {};
  }
}

/** 当前会话是否已登录管理员 */
export async function isAdmin(): Promise<boolean> {
  const session = await safeAuth();
  return session?.user?.role === "ADMIN";
}

/** 当前会话是否已登录（任意角色） */
export async function isAuthenticated(): Promise<boolean> {
  const session = await safeAuth();
  return Boolean(session?.user);
}

/** 取当前会话 memberId（未登录返回 null） */
export async function getSessionMemberId(): Promise<string | null> {
  const session = await safeAuth();
  return session?.user?.memberId ?? null;
}

/**
 * 要求：已登录管理员。不满足则抛错（调用方需 try/catch 转成 ActionState）。
 * 管理端 Server Action 一律先调用本函数。
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("无权访问：需要管理员权限");
  }
}

/**
 * 要求：已登录会员（有 memberId）。不满足则抛错。
 * 会员侧 Server Action 用本函数取 memberId 并完成登录校验。
 */
export async function requireMember(): Promise<string> {
  const memberId = await getSessionMemberId();
  if (!memberId) {
    throw new Error("请先登录会员账号");
  }
  return memberId;
}

/**
 * 面向「返回 ActionState」风格的守卫：返回错误文案或 null。
 * 适合不想抛错的调用方（如表单 action 直接返回 { error }）。
 */
export async function adminGuardError(): Promise<string | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "无权访问";
  }
}

/** 面向「返回 ActionState」风格的会员守卫：返回错误文案或 null */
export async function memberGuardError(): Promise<string | null> {
  try {
    await requireMember();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "请先登录会员账号";
  }
}
