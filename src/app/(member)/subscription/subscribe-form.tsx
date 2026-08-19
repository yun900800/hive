"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { changeSubscriptionAction, type SubscribeState } from "@/modules/membership/interface/actions/subscribe";

const initialState: SubscribeState = {};

export type PlanVariant = "SUBSCRIBE" | "CURRENT" | "UPGRADE" | "DOWNGRADE";

export function SubscribeForm({
  planId,
  disabled,
  variant = "SUBSCRIBE",
}: {
  planId: string;
  disabled: boolean;
  variant?: PlanVariant;
}) {
  const [state, action, pending] = useActionState(changeSubscriptionAction, initialState);

  const label = disabled
    ? "已订阅"
    : pending
      ? "订阅中…"
      : variant === "UPGRADE"
        ? "升级"
        : variant === "DOWNGRADE"
          ? "降级"
          : "立即订阅";

  return (
    <form
      action={action}
      onSubmit={
        variant === "DOWNGRADE"
          ? (e) => {
              // 降级实时生效，先弹窗确认再提交
              if (!window.confirm("降级立即生效，当月已付月费不退，确定降级？")) {
                e.preventDefault();
              }
            }
          : undefined
      }
    >
      <input type="hidden" name="planId" value={planId} />
      {state.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={disabled || pending}>
        {label}
      </Button>
    </form>
  );
}
