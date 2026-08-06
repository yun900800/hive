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
      // First sign-in: hydrate token with user row details.
      if (user?.id) {
        const row = await db
          .select({
            role: users.role,
            memberId: users.memberId,
            name: users.name,
          })
          .from(users)
          .where(eq(users.id, user.id))
          .get();
        token.role = row?.role ?? "MEMBER";
        token.memberId = row?.memberId ?? null;
        token.name = row?.name ?? user.name ?? null;
      }
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
