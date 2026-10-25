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
  createMeetingRoomAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

const roomTypeItems = {
  MEETING_ROOM: "会议室",
  PRIVATE_OFFICE: "独立办公室",
};

export function RoomForm() {
  const [state, action, pending] = useActionState(
    createMeetingRoomAction,
    initialState
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-border/80 bg-card p-5 ring-1 ring-foreground/[0.02]"
    >
      <div>
        <h2 className="text-sm font-semibold">新增会议室 / 独立办公室</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          时租用于会员预订后的费用计算。
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="room-name">名称</Label>
          <Input id="room-name" name="name" placeholder="华山厅" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-capacity">容量（人）</Label>
          <Input
            id="room-capacity"
            name="capacity"
            type="number"
            min={1}
            placeholder="8"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-rate">时租（元）</Label>
          <Input
            id="room-rate"
            name="hourlyRate"
            type="number"
            min={0}
            step="0.01"
            placeholder="60"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-type">类型</Label>
          <Select name="type" defaultValue="MEETING_ROOM" items={roomTypeItems}>
            <SelectTrigger id="room-type" className="w-full">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEETING_ROOM">会议室</SelectItem>
              <SelectItem value="PRIVATE_OFFICE">独立办公室</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          variant="brand"
          className="w-full"
          disabled={pending}
        >
          {pending ? "添加中…" : "添加空间"}
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
