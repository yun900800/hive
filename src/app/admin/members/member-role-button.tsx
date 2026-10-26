"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionWithToast } from "@/lib/toast";
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
  const actionWithToast = useActionWithToast(setMemberRoleAction, {
    successMessage: "角色已更新",
    id: `member-role-${memberId}`,
  });
  const [state, formAction, pending] = useActionState(
    actionWithToast,
    initialState
  );
  const nextRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="role" value={nextRole} />
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
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
