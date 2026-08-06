"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createDeskAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

export function DeskForm() {
  const [state, action, pending] = useActionState(createDeskAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
      <div className="space-y-1">
        <Label htmlFor="floor">楼层（字母）</Label>
        <Input id="floor" name="floor" placeholder="B" required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zone">分区（数字）</Label>
        <Input id="zone" name="zone" placeholder="1" required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="deskNumber">工位号</Label>
        <Input id="deskNumber" name="deskNumber" placeholder="2" required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="type">类型</Label>
        <select
          id="type"
          name="type"
          className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="STANDARD"
        >
          <option value="STANDARD">标准位</option>
          <option value="WINDOW_SIDE">靠窗</option>
          <option value="QUIET_ZONE">静区</option>
          <option value="STANDING">站立位</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "添加中…" : "添加工位"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
