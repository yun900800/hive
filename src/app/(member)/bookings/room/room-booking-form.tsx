"use client";

import { useState, useEffect, useRef } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, DoorOpen, Users } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createRoomBookingAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";
import { formatYuan } from "@/lib/format";
import { cn } from "@/lib/utils";

const initialState: ActionState = {};

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
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id ?? "");
  const router = useRouter();
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!submittedRef.current) return;
    if (!state.error) {
      router.push("/bookings");
    }
    submittedRef.current = false;
  }, [state, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submittedRef.current = true;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const start = fd.get("start") as string;
    const end = fd.get("end") as string;
    if (!start || !end || !selectedRoomId) return;
    fd.set("roomId", selectedRoomId);
    fd.set("start", new Date(start).toISOString());
    fd.set("end", new Date(end).toISOString());
    action(fd);
  }

  const now = new Date();
  const defaultStart = toLocalInput(now);
  const defaultEnd = toLocalInput(new Date(now.getTime() + 2 * 3600_000));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">选择会议室 / 独立办公室 ({rooms.length} 间可用)</Label>
        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            当前暂无可预订的会议室。
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 max-h-[340px] overflow-y-auto pr-1">
            {rooms.map((r) => {
              const isSelected = selectedRoomId === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoomId(r.id)}
                  className={cn(
                    "relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all",
                    isSelected
                      ? "border-brand bg-brand-soft/60 ring-2 ring-brand/30"
                      : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-lg bg-background text-brand-strong shadow-xs">
                        <DoorOpen className="size-4.5" aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold">{r.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Users className="size-3.5" />
                          <span>宜容纳 {r.capacity} 人</span>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="size-5 text-brand-strong" aria-hidden />
                    )}
                  </div>

                  {r.equipments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {r.equipments.map((eq) => (
                        <span
                          key={eq}
                          className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-[11px] text-muted-foreground border border-border/50"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                    <span className="text-muted-foreground">标准费率</span>
                    <span className="font-semibold text-foreground">
                      {formatYuan(r.hourlyRateYuan * 100)} / 小时
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border/80 bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="start" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" /> 开始时间
          </Label>
          <Input id="start" name="start" type="datetime-local" defaultValue={defaultStart} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" /> 结束时间
          </Label>
          <Input id="end" name="end" type="datetime-local" defaultValue={defaultEnd} required />
        </div>
      </div>

      {state.error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        className="w-full h-11 text-base"
        disabled={pending || rooms.length === 0 || !selectedRoomId}
      >
        {rooms.length === 0 ? "暂无可预订会议室" : pending ? "正在确认预订…" : "确认并提交预订"}
      </Button>
    </form>
  );
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
