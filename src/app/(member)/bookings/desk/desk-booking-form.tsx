"use client";

import { useState, useActionState } from "react";
import { Armchair, CheckCircle2, Clock } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createDeskBookingAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";
import { cn } from "@/lib/utils";

const initialState: ActionState = {};

export function DeskBookingForm({
  desks,
}: {
  desks: Array<{ id: string; code: string; floor: string; zone: string; type?: string }>;
}) {
  const [state, action, pending] = useActionState(createDeskBookingAction, initialState);
  const [selectedDeskId, setSelectedDeskId] = useState<string>(desks[0]?.id ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const start = fd.get("start") as string;
    const end = fd.get("end") as string;
    if (!start || !end || !selectedDeskId) return;
    fd.set("deskId", selectedDeskId);
    fd.set("start", new Date(start).toISOString());
    fd.set("end", new Date(end).toISOString());
    action(fd);
  }

  const now = new Date();
  const nextHour = new Date(now.getTime() + 3600_000);
  const defaultStart = toLocalInput(now);
  const defaultEnd = toLocalInput(new Date(nextHour.getTime() + 7200_000)); // 默认2小时

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">选择目标工位 ({desks.length} 个可用)</Label>
        {desks.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            当前暂无可预订的工位。
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[320px] overflow-y-auto pr-1">
            {desks.map((d) => {
              const isSelected = selectedDeskId === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDeskId(d.id)}
                  className={cn(
                    "relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all",
                    isSelected
                      ? "border-brand bg-brand-soft/60 ring-2 ring-brand/30"
                      : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-background text-brand-strong shadow-xs">
                        <Armchair className="size-4" aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold">{d.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.floor} 层 · {d.zone} 区
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="size-5 text-brand-strong" aria-hidden />
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                    <span>{d.type ? labelType(d.type) : "标准固定位"}</span>
                    <span className="font-medium text-emerald-600">随时可用</span>
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
        disabled={pending || desks.length === 0 || !selectedDeskId}
      >
        {desks.length === 0 ? "暂无可预订工位" : pending ? "正在确认预订…" : "确认并提交预订"}
      </Button>
    </form>
  );
}

function labelType(type: string): string {
  const map: Record<string, string> = {
    STANDARD: "标准位",
    WINDOW_SIDE: "靠窗位",
    QUIET_ZONE: "静区",
    STANDING: "站立位",
  };
  return map[type] ?? type;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
