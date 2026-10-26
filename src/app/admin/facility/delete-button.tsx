"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useActionWithToast } from "@/lib/toast";
import {
  deleteDeskAction,
  deleteMeetingRoomAction,
  type ActionState,
} from "@/modules/facility/interface/actions/facility";

const initialState: ActionState = {};

export function DeleteButton({
  kind,
  id,
  label,
}: {
  kind: "desk" | "room";
  id: string;
  label: string;
}) {
  const handler = kind === "desk" ? deleteDeskAction : deleteMeetingRoomAction;
  const actionWithToast = useActionWithToast(handler, {
    successMessage: `已删除「${label}」`,
    id: `facility-delete-${kind}-${id}`,
  });
  const [state, action, pending] = useActionState(
    actionWithToast,
    initialState
  );

  return (
    <form action={action} className="inline-flex items-center justify-end">
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={`删除 ${label}`}
        title={`删除 ${label}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        disabled={pending}
        onClick={(event) => {
          if (!confirm(`确定删除「${label}」吗？此操作不可撤销。`)) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      {state.error && (
        <span role="alert" className="sr-only">
          {state.error}
        </span>
      )}
    </form>
  );
}
