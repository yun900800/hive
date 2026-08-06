"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  registerAction,
  type RegisterState,
} from "@/modules/membership/interface/actions/auth";

const initialState: RegisterState = {};

export function RegisterForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerAction, initialState);

  function handleDone(e: React.FormEvent<HTMLFormElement>) {
    // action 返回无 error 时视为注册成功
    if (!pending && !state.error) {
      router.push("/login");
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input id="name" name="name" placeholder="张三" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">手机号（选填）</Label>
            <Input id="phone" name="phone" placeholder="13800000000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码（至少 6 位）</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "注册中…" : "注册"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
