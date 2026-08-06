"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { subscribePlanAction, type SubscribeState } from "@/modules/membership/interface/actions/subscribe";

const initialState: SubscribeState = {};

export function SubscribeForm({ planId, disabled }: { planId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(subscribePlanAction, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="planId" value={planId} />
      {state.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={disabled || pending}>
        {disabled ? "已订阅" : pending ? "订阅中…" : "立即订阅"}
      </Button>
    </form>
  );
}
