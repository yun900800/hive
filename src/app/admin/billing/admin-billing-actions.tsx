"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    action === "generate"
      ? adminGenerateInvoiceAction
      : action === "pay"
        ? adminPayInvoiceAction
        : adminDispatchOutboxAction,
    initialState
  );

  if (action === "generate") {
    const memberItems = Object.fromEntries(
      (members ?? []).map((member) => [member.id, member.name])
    );

    return (
      <form action={formAction} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="invoice-member">会员</Label>
            <Select
              name="memberId"
              defaultValue={members?.[0]?.id}
              disabled={!members || members.length === 0}
              items={memberItems}
            >
              <SelectTrigger id="invoice-member" className="w-48">
                <SelectValue placeholder="选择会员" />
              </SelectTrigger>
              <SelectContent>
                {members?.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-month">账单月份</Label>
            <Input
              id="invoice-month"
              name="month"
              defaultValue={month}
              pattern="\d{4}-\d{2}"
              placeholder="2026-10"
              className="w-36"
              required
            />
          </div>

          <Button type="submit" variant="brand" disabled={pending}>
            {pending ? "出账中…" : "生成账单"}
          </Button>
        </div>

        <ActionFeedback state={state} />
      </form>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      {memberId && <input type="hidden" name="memberId" value={memberId} />}
      <Button
        type="submit"
        size={action === "pay" ? "sm" : "default"}
        variant={action === "pay" ? "outline" : "secondary"}
        disabled={pending}
      >
        {action === "pay"
          ? pending
            ? "处理中…"
            : "标记支付"
          : pending
            ? "分发中…"
            : "冲刷 Outbox 事件"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function ActionFeedback({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        state.error
          ? "text-xs text-destructive"
          : "text-xs text-emerald-600"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}
