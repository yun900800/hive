"use client";

import { useActionState } from "react";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useActionWithToast } from "@/lib/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  startFlexSessionAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";

const initialState: ActionState = {};

/** 灵活区入场签到表单 */
export function FlexCheckInForm({
  zones,
}: {
  zones: Array<{ id: string; name: string; capacity: number }>;
}) {
  const actionWithToast = useActionWithToast(startFlexSessionAction, {
    successMessage: "签到成功，欢迎入场",
    id: "flex-checkin",
  });
  const [state, action, pending] = useActionState(
    actionWithToast,
    initialState
  );

  if (zones.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        当前没有开放中的区域，请稍后再试。
      </p>
    );
  }

  const zoneItems = Object.fromEntries(
    zones.map((zone) => [zone.id, `${zone.name}（容量 ${zone.capacity} 人）`])
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="zoneId">区域</Label>
        <Select
          name="zoneId"
          defaultValue={zones[0]?.id}
          items={zoneItems}
          disabled={pending}
        >
          <SelectTrigger id="zoneId" className="w-full">
            <SelectValue placeholder="选择区域" />
          </SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}（容量 {zone.capacity} 人）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        variant="brand"
        className="w-full"
        disabled={pending}
      >
        {pending ? "签到中…" : "签到入场"}
      </Button>
    </form>
  );
}
