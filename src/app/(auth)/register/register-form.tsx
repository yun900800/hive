"use client";

import { useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  registerAction,
  type RegisterState,
} from "@/modules/membership/interface/actions/auth";

const initialState: RegisterState = {};

export function RegisterForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerAction, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!submittedRef.current) return;
    if (!state.error) router.push("/login");
    submittedRef.current = false;
  }, [state, router]);

  return (
    <form
      action={action}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">姓名</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="张三"
          className="h-11"
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          className="h-11"
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">手机号（选填）</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="13800000000"
          className="h-11"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码（至少 6 位）</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          className="h-11"
          required
          disabled={pending}
        />
      </div>

      <div aria-live="polite" aria-atomic="true">
        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="brand"
        className="h-11 w-full"
        disabled={pending}
      >
        {pending ? "正在创建账号…" : "创建账号"}
      </Button>
    </form>
  );
}
