import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { env } from "@/lib/env";
import { loadLabSource } from "@/modules/billing/application/invoice-lab";
import { PageHeader } from "@/components/patterns/page-header";
import { InvoiceLabClient } from "./invoice-lab-client";

export default async function InvoiceLabPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const source = await loadLabSource();
  const configured = Boolean(env.INVOICE_WEBHOOK_URL && env.INVOICE_WEBHOOK_TOKEN);
  const initialEmail = session.user.email ?? source.member.email;
  const sourceLabel = source.invoice
    ? `${source.member.name || "未知会员"} · ${source.invoice.billingMonth} · ${source.invoice.status}`
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="发票联调台"
        description="选一组测试载荷、填收件邮箱，直接打到真实的 n8n 工作流。载荷只读，只有一个字段可改。"
      />

      <InvoiceLabClient
        source={source}
        initialEmail={initialEmail}
        configured={configured}
        sourceLabel={sourceLabel}
      />
    </div>
  );
}
