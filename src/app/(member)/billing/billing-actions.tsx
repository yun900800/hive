"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionWithToast } from "@/lib/toast";
import {
  generateMyInvoiceAction,
  payInvoiceAction,
  type ActionState,
} from "@/modules/billing/interface/actions/billing";

const initialState: ActionState = {};

/** 账单操作：生成本月账单 / 模拟支付 */
export function BillingActions({
  action,
  invoiceId,
  disabled,
}: {
  action: "generate" | "pay";
  invoiceId?: string;
  disabled?: boolean;
}) {
  const handler =
    action === "generate" ? generateMyInvoiceAction : payInvoiceAction;
  const actionWithToast = useActionWithToast(handler, {
    successMessage: action === "generate" ? "本月账单已生成" : "支付成功",
    id:
      action === "generate"
        ? "billing-generate"
        : `billing-pay-${invoiceId ?? "unknown"}`,
  });
  const [state, formAction, pending] = useActionState(
    actionWithToast,
    initialState
  );

  return (
    <form action={formAction}>
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      <div className="flex flex-col items-end gap-1">
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" variant={action === "pay" ? "default" : "outline"} disabled={pending || disabled}>
          {action === "generate" ? (pending ? "出账中…" : "生成本月账单") : pending ? "支付中…" : "模拟支付"}
        </Button>
      </div>
    </form>
  );
}
