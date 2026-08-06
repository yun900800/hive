"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createMeetingRoomAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

export function RoomForm() {
  const [state, action, pending] = useActionState(createMeetingRoomAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
      <div className="space-y-1">
        <Label htmlFor="name">名称</Label>
        <Input id="name" name="name" placeholder="华山厅" required className="w-36" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="capacity">容量</Label>
        <Input id="capacity" name="capacity" type="number" min={1} placeholder="8" required className="w-24" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="hourlyRate">时租（元）</Label>
        <Input id="hourlyRate" name="hourlyRate" type="number" min={0} step="0.01" placeholder="60" required className="w-28" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "添加中…" : "添加会议室"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
