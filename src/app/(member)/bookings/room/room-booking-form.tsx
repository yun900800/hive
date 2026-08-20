"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createRoomBookingAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";
import { formatYuan } from "@/lib/format";

const initialState: ActionState = {};

/** 会议室预订表单：datetime-local 转 UTC ISO 提交 */
export function RoomBookingForm({
  rooms,
}: {
  rooms: Array<{
    id: string;
    name: string;
    capacity: number;
    equipments: string[];
    hourlyRateYuan: number;
  }>;
}) {
  const [state, action, pending] = useActionState(createRoomBookingAction, initialState);
  const router = useRouter();
  const submittedRef = useRef(false);

  // 预订成功后跳转到我的预定页
  useEffect(() => {
    if (!submittedRef.current) return;
    if (!state.error) {
      router.push("/bookings");
    }
    submittedRef.current = false;
  }, [state, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // React 19 表单 action 会在合成 onSubmit 之前就读取 FormData，
    // 因此在 onSubmit 里改 input.value 不生效；这里改为手动构造并转换后直接提交。
    e.preventDefault();
    submittedRef.current = true;
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
  const defaultStart = toLocalInput(now);
  const defaultEnd = toLocalInput(new Date(now.getTime() + 2 * 3600_000));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="roomId">会议室</Label>
        <select
          id="roomId"
          name="roomId"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          required
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}（{r.capacity} 人 · {formatYuan(r.hourlyRateYuan * 100)}/时 · {r.equipments.join("、") || "无设备"}）
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
      <div className="space-y-2">
        <Label htmlFor="attendees">预计参会人数（选填）</Label>
        <Input id="attendees" name="attendees" type="number" min={1} placeholder="4" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending || rooms.length === 0}>
        {rooms.length === 0 ? "暂无可预订会议室" : pending ? "预订中…" : "立即预订"}
      </Button>
    </form>
  );
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
