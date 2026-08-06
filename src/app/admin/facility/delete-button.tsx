"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
  const [state, action, pending] = useActionState(
    kind === "desk" ? deleteDeskAction : deleteMeetingRoomAction,
    initialState
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={pending}
        onClick={(e) => {
          if (!confirm(`确定删除「${label}」吗？`)) e.preventDefault();
        }}
      >
        {pending ? "删除中…" : "删除"}
      </Button>
    </form>
  );
}
