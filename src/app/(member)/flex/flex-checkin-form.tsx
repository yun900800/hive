"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  const [state, action, pending] = useActionState(startFlexSessionAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="zoneId">区域</Label>
        <select
          id="zoneId"
          name="zoneId"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          required
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}（容量 {z.capacity}）
            </option>
          ))}
        </select>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending || zones.length === 0}>
        {zones.length === 0 ? "暂无可开放区域" : pending ? "签到中…" : "签到入场"}
      </Button>
    </form>
  );
}
