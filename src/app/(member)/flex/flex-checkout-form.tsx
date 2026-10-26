"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { useActionWithToast } from "@/lib/toast";
import {
  endFlexSessionAction,
  type ActionState,
} from "@/modules/booking/interface/actions/booking";

const initialState: ActionState = {};

/** 灵活区离场按钮 */
export function FlexCheckOutForm({ sessionId }: { sessionId: string }) {
  const actionWithToast = useActionWithToast(endFlexSessionAction, {
    successMessage: "已离场签退",
    id: `flex-checkout-${sessionId}`,
  });
  const [state, action, pending] = useActionState(
    actionWithToast,
    initialState
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={sessionId} />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        variant="destructive"
        className="w-full sm:w-auto"
        disabled={pending}
      >
        {pending ? "处理中…" : "离场签退"}
      </Button>
    </form>
  );
}
