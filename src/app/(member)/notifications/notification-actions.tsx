"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  markNotificationReadAction,
  markAllReadAction,
  type ActionState,
} from "@/modules/notification/interface/actions/notification";

const initialState: ActionState = {};

/** 通知操作：标记已读 / 全部已读 */
export function NotificationActions({
  action,
  id,
}: {
  action: "one" | "all";
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action === "all" ? markAllReadAction : markNotificationReadAction,
    initialState
  );

  return (
    <form action={formAction}>
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {action === "all" ? "全部已读" : "标记已读"}
      </Button>
    </form>
  );
}
