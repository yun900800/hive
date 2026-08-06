import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "注册 · 蜂巢共享办公" };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16">
      <h1 className="mb-8 text-2xl font-bold">注册蜂巢会员</h1>
      <RegisterForm />
      <p className="mt-6 text-sm text-muted-foreground">
        已有账号？{" "}
        <a href="/login" className="text-foreground underline underline-offset-4">
          去登录
        </a>
      </p>
    </div>
  );
}
