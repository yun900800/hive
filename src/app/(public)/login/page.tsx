import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登录 · 蜂巢共享办公" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16">
      <h1 className="mb-8 text-2xl font-bold">登录蜂巢</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-muted-foreground">
        还没有账号？{" "}
        <a href="/register" className="text-foreground underline underline-offset-4">
          立即注册
        </a>
      </p>
    </div>
  );
}
