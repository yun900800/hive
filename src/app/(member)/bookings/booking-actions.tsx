"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionWithToast } from "@/lib/toast";
import {
  cancelDeskBookingAction,
  checkInDeskBookingAction,
  checkOutDeskBookingAction,
  startRoomBookingAction,
  completeRoomBookingAction,
  cancelRoomBookingAction,
  endFlexSessionAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";

const initialState: ActionState = {};

const SUCCESS_MESSAGES: Record<string, string> = {
  取消: "预订已取消",
  签到: "签到成功",
  签退: "签退成功",
  开始使用: "已开始使用会议室",
  完成: "会议室使用已结束",
  离场: "已离场签退",
};

type Handler = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const deskHandlers: Record<string, Array<{ label: string; action: Handler; variant?: "outline" | "destructive" }>> = {
  CONFIRMED: [
    { label: "取消", action: cancelDeskBookingAction, variant: "outline" },
    { label: "签到", action: checkInDeskBookingAction },
  ],
  CHECKED_IN: [{ label: "签退", action: checkOutDeskBookingAction }],
};

const roomHandlers: Record<string, Array<{ label: string; action: Handler; variant?: "outline" | "destructive" }>> = {
  CONFIRMED: [
    { label: "取消", action: cancelRoomBookingAction, variant: "outline" },
    { label: "开始使用", action: startRoomBookingAction },
  ],
  IN_PROGRESS: [{ label: "完成", action: completeRoomBookingAction }],
};

const flexHandlers: Record<string, Array<{ label: string; action: Handler; variant?: "outline" | "destructive" }>> = {
  ACTIVE: [{ label: "离场", action: endFlexSessionAction, variant: "destructive" }],
};

/** 单条预订的行内操作按钮（按类型+状态渲染，可能多个按钮） */
export function BookingActions({
  type,
  id,
  status,
}: {
  type: "DESK" | "ROOM" | "FLEX";
  id: string;
  status: string;
}) {
  const table = type === "DESK" ? deskHandlers : type === "ROOM" ? roomHandlers : flexHandlers;
  const handlers = table[status] ?? [];

  if (handlers.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {handlers.map((h) => (
          <ActionButton key={h.label} id={id} handler={h} />
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  id,
  handler,
}: {
  id: string;
  handler: { label: string; action: Handler; variant?: "outline" | "destructive" };
}) {
  const actionWithToast = useActionWithToast(handler.action, {
    successMessage: SUCCESS_MESSAGES[handler.label] ?? "操作成功",
    id: `booking-${id}-${handler.label}`,
  });
  const [state, action, pending] = useActionState(
    actionWithToast,
    initialState
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <p role="alert" className="mb-1 text-right text-xs text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        variant={handler.variant ?? "default"}
        disabled={pending}
        className="min-h-11 sm:min-h-0"
      >
        {handler.label}
      </Button>
    </form>
  );
}
