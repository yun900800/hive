import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

/**
 * Auth.js v5 (NextAuth beta) — email/password (Credentials) sign-in.
 *
 * Why JWT strategy (not database sessions)?
 *   Auth.js requires JWT sessions when ONLY the Credentials provider is used.
 *   The Drizzle adapter is still used to persist users; sessions ride in JWTs.
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Dev fallback so `next dev` works without a .env file.
// Production MUST set AUTH_SECRET — otherwise auth fails loudly.
const authSecret =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "hive-dev-secret-do-not-use-in-production-please-change");

/**
 * 角色/会员关系的快照缓存。
 *
 * JWT 里的 role 是签发时的值；管理员降权后如果只在库里改，旧 token 会一直有效
 * 到过期（默认 30 天）。这里在每次会话解析时比对 sessionVersion：
 * 版本不一致 → 返回 null → 会话失效，用户重新登录。
 *
 * 30 秒进程内缓存把「每个请求一次主键查询」摊掉；代价是变更最长 30 秒生效。
 */
type AuthSnapshot = {
  role: string;
  memberId: string | null;
  name: string | null;
  sessionVersion: number;
};

const AUTH_CACHE_TTL_MS = 30_000;
const authSnapshotCache = new Map<string, { snapshot: AuthSnapshot | null; at: number }>();

async function loadAuthSnapshot(userId: string): Promise<AuthSnapshot | null> {
  const now = Date.now();
  const cached = authSnapshotCache.get(userId);
  if (cached && now - cached.at < AUTH_CACHE_TTL_MS) return cached.snapshot;

  const row = await db
    .select({
      role: users.role,
      memberId: users.memberId,
      name: users.name,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  const snapshot: AuthSnapshot | null = row
    ? {
        role: row.role,
        memberId: row.memberId ?? null,
        name: row.name ?? null,
        sessionVersion: row.sessionVersion ?? 0,
      }
    : null;

  if (authSnapshotCache.size > 500) authSnapshotCache.clear();
  authSnapshotCache.set(userId, { snapshot, at: now });
  return snapshot;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // role/memberId are attached in the jwt callback below
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;
      if (!userId) return token;

      const snapshot = await loadAuthSnapshot(userId);
      // 账号被删除 → 会话立即失效
      if (!snapshot) return null;

      // 首次登录：把角色/会员关系写进 token
      if (user?.id) {
        token.role = snapshot.role;
        token.memberId = snapshot.memberId;
        token.name = snapshot.name ?? user.name ?? null;
        token.sv = snapshot.sessionVersion;
        return token;
      }

      // 已登录会话：版本不一致说明角色被调整过，强制重新登录
      // （旧 token 没有 sv 字段，直接采纳当前版本，避免升级时全员被登出）
      if (typeof token.sv === "number" && token.sv !== snapshot.sessionVersion) {
        return null;
      }

      token.role = snapshot.role;
      token.memberId = snapshot.memberId;
      token.sv = snapshot.sessionVersion;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined;
        session.user.memberId = token.memberId as string | null | undefined;
      }
      return session;
    },
  },
});

/** Type augmentation for session.user (role + memberId). */
declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      memberId?: string | null;
    };
  }
}
