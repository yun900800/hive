"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  adminGenerateInvoiceAction,
  adminPayInvoiceAction,
  adminDispatchOutboxAction,
  type ActionState,
} from "@/modules/billing/interface/actions/admin-billing";

const initialState: ActionState = {};

/** 管理端账单操作：出账 / 支付 / 冲刷事件 */
export function AdminBillingActions({
  action,
  members,
  month,
  invoiceId,
  memberId,
}: {
  action: "generate" | "pay" | "dispatch";
  members?: Array<{ id: string; name: string }>;
  month?: string;
  invoiceId?: string;
  memberId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action === "generate" ? adminGenerateInvoiceAction : action === "pay" ? adminPayInvoiceAction : adminDispatchOutboxAction,
    initialState
  );

  if (action === "generate") {
    return (
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>会员</Label>
          <select
            name="memberId"
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            required
          >
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>月份</Label>
          <Input name="month" defaultValue={month} pattern="\d{4}-\d{2}" className="w-32" required />
        </div>
        <Button type="submit" disabled={pending}>{pending ? "出账中…" : "出账"}</Button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      </form>
    );
  }

  return (
    <form action={formAction}>
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      {memberId && <input type="hidden" name="memberId" value={memberId} />}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-600">{state.success}</p>}
      <Button type="submit" size={action === "pay" ? "sm" : "default"} variant="outline" disabled={pending}>
        {action === "pay" ? (pending ? "处理中…" : "标记支付") : pending ? "分发中…" : "冲刷 Outbox 事件"}
      </Button>
    </form>
  );
}
