"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth";
import { registerMember } from "@/modules/membership/application/membership-app";

const registerSchema = z.object({
  name: z.string().min(2, "姓名至少 2 个字符").max(50),
  email: z.string().email("邮箱格式不正确"),
  phone: z.string().optional(),
  password: z.string().min(6, "密码至少 6 位").max(72),
});

export type RegisterState = {
  error?: string;
};

/** 注册会员 → 成功后返回登录页 */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "输入有误" };
  }

  try {
    await registerMember(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "注册失败" };
  }

  return { error: undefined };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** 登录（Credentials） */
export async function loginAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "请输入正确的邮箱和密码" };

  try {
    await nextAuthSignIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { error: undefined };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "邮箱或密码错误" };
        default:
          return { error: "登录失败，请重试" };
      }
    }
    throw error; // redirect throws — must rethrow
  }
}

/** 退出登录 */
export async function logoutAction(): Promise<void> {
  await nextAuthSignOut({ redirectTo: "/" });
}
