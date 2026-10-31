"use client";

import { useActionState } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createFlexZoneAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

export function FlexZoneForm() {
  const [state, action, pending] = useActionState(
    createFlexZoneAction,
    initialState
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-border/80 bg-card p-5 ring-1 ring-foreground/[0.02]"
    >
      <div>
        <h2 className="text-sm font-semibold">新增灵活办公区</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          区域开放后，会员到场即可在灵活区页面签到计时。
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="zone-name">名称</Label>
          <Input
            id="zone-name"
            name="name"
            placeholder="C区灵活办公区"
            required
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-floor">楼层（字母）</Label>
          <Input
            id="zone-floor"
            name="floor"
            placeholder="C"
            required
            maxLength={1}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-capacity">容量（人）</Label>
          <Input
            id="zone-capacity"
            name="capacity"
            type="number"
            min={1}
            max={500}
            placeholder="30"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-opening">开放时间</Label>
          <Input
            id="zone-opening"
            name="openingTime"
            type="time"
            defaultValue="08:00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-closing">关闭时间</Label>
          <Input
            id="zone-closing"
            name="closingTime"
            type="time"
            defaultValue="22:00"
            required
          />
        </div>
        <Button
          type="submit"
          variant="brand"
          className="w-full"
          disabled={pending}
        >
          {pending ? "添加中…" : "添加灵活区"}
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
