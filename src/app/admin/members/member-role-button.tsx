"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  setMemberRoleAction,
  type RoleState,
} from "@/modules/membership/interface/actions/admin-member";

const initialState: RoleState = {};

/** 会员管理：切换管理员/普通会员角色按钮 */
export function MemberRoleButton({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: string;
}) {
  const [state, formAction, pending] = useActionState(setMemberRoleAction, initialState);
  const nextRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="role" value={nextRole} />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-600">{state.success}</p>}
      <Button
        type="submit"
        size="sm"
        variant={currentRole === "ADMIN" ? "outline" : "secondary"}
        disabled={pending}
      >
        {pending
          ? "处理中…"
          : currentRole === "ADMIN"
            ? "取消管理员"
            : "设为管理员"}
      </Button>
    </form>
  );
}
