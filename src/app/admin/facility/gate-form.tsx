"use client";

import { useActionState } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createGateAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

const gateTypeItems = {
  ENTRY_TURNSTILE: "入口闸机",
  EXIT_TURNSTILE: "出口闸机",
  EMERGENCY_EXIT: "紧急出口",
  ELEVATOR_CONTROL: "梯控",
};

export function GateForm() {
  const [state, action, pending] = useActionState(
    createGateAction,
    initialState
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-border/80 bg-card p-5 ring-1 ring-foreground/[0.02]"
    >
      <div>
        <h2 className="text-sm font-semibold">新增闸机设备</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          配置物理出入口设备，用于通行记录与扫码核销。
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="gate-name">名称</Label>
          <Input
            id="gate-name"
            name="name"
            placeholder="东区入口2号闸机"
            required
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gate-floor">楼层（字母）</Label>
          <Input
            id="gate-floor"
            name="floor"
            placeholder="A"
            required
            maxLength={1}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gate-zone">区域/位置</Label>
          <Input
            id="gate-zone"
            name="zone"
            placeholder="entrance"
            defaultValue="entrance"
            required
            maxLength={20}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gate-type">类型</Label>
          <Select
            name="type"
            defaultValue="ENTRY_TURNSTILE"
            items={gateTypeItems}
          >
            <SelectTrigger id="gate-type" className="w-full">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENTRY_TURNSTILE">入口闸机</SelectItem>
              <SelectItem value="EXIT_TURNSTILE">出口闸机</SelectItem>
              <SelectItem value="EMERGENCY_EXIT">紧急出口</SelectItem>
              <SelectItem value="ELEVATOR_CONTROL">梯控</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          variant="brand"
          className="w-full"
          disabled={pending}
        >
          {pending ? "添加中…" : "添加闸机"}
        </Button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
