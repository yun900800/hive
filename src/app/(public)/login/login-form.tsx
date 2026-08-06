"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loginAction, type RegisterState } from "@/modules/membership/interface/actions/auth";

const initialState: RegisterState = {};

export function LoginForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "登录中…" : "登录"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            演示账号：admin@hive.com / admin123
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
