"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createDeskBookingAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";

const initialState: ActionState = {};

/** 工位预订表单：datetime-local 转 UTC ISO 提交 */
export function DeskBookingForm({
  desks,
}: {
  desks: Array<{ id: string; code: string; floor: string; zone: string }>;
}) {
  const [state, action, pending] = useActionState(createDeskBookingAction, initialState);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // React 19 表单 action 会在合成 onSubmit 之前就读取 FormData，
    // 因此在 onSubmit 里改 input.value 不生效；这里改为手动构造并转换后直接提交。
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const start = fd.get("start") as string;
    const end = fd.get("end") as string;
    if (!start || !end) return; // required 兜底
    fd.set("start", new Date(start).toISOString());
    fd.set("end", new Date(end).toISOString());
    action(fd);
  }

  const now = new Date();
  const nextHour = new Date(now.getTime() + 3600_000);
  const defaultStart = toLocalInput(now);
  const defaultEnd = toLocalInput(new Date(nextHour.getTime() + 3600_000));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deskId">工位</Label>
        <select
          id="deskId"
          name="deskId"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          required
        >
          {desks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code}（{d.floor} 层 · {d.zone} 区）
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start">开始时间</Label>
          <Input id="start" name="start" type="datetime-local" defaultValue={defaultStart} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">结束时间</Label>
          <Input id="end" name="end" type="datetime-local" defaultValue={defaultEnd} required />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending || desks.length === 0}>
        {desks.length === 0 ? "暂无可预订工位" : pending ? "预订中…" : "立即预订"}
      </Button>
    </form>
  );
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
