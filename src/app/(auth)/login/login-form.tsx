"use client";

import { useActionState } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  loginAction,
  type RegisterState,
} from "@/modules/membership/interface/actions/auth";

const initialState: RegisterState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
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
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? "正在登录…" : "登录"}
      </Button>

      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3">
        <p className="text-xs font-medium text-foreground">
          演示账号（管理员）
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>邮箱：admin@hive.com</span>
          <span>密码：admin123</span>
        </div>
      </div>
    </form>
  );
}
