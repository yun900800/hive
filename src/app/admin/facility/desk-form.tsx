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
  createDeskAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

const deskTypeItems = {
  STANDARD: "标准位",
  WINDOW_SIDE: "靠窗位",
  QUIET_ZONE: "静区",
  STANDING: "站立位",
};

export function DeskForm() {
  const [state, action, pending] = useActionState(createDeskAction, initialState);

  return (
    <form
      action={action}
      className="rounded-xl border border-border/80 bg-card p-5 ring-1 ring-foreground/[0.02]"
    >
      <div>
        <h2 className="text-sm font-semibold">新增工位</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          按楼层、分区与工位号自动生成工位编码。
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="desk-floor">楼层（字母）</Label>
          <Input
            id="desk-floor"
            name="floor"
            placeholder="B"
            required
            maxLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desk-zone">分区（数字）</Label>
          <Input
            id="desk-zone"
            name="zone"
            placeholder="1"
            required
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desk-number">工位号</Label>
          <Input
            id="desk-number"
            name="deskNumber"
            placeholder="2"
            required
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desk-type">类型</Label>
          <Select name="type" defaultValue="STANDARD" items={deskTypeItems}>
            <SelectTrigger id="desk-type" className="w-full">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">标准位</SelectItem>
              <SelectItem value="WINDOW_SIDE">靠窗位</SelectItem>
              <SelectItem value="QUIET_ZONE">静区</SelectItem>
              <SelectItem value="STANDING">站立位</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          variant="brand"
          className="w-full"
          disabled={pending}
        >
          {pending ? "添加中…" : "添加工位"}
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
