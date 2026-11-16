"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sendTestInvoiceAction,
  type LabActionState,
  type LabResponse,
} from "@/modules/billing/interface/actions/invoice-lab";
import {
  buildLabPayload,
  kindNeedsInvoice,
  type LabKind,
  type LabSource,
} from "@/modules/billing/domain/invoice-lab-payloads";

const initialState: LabActionState = {};

const TABS: Array<{ value: LabKind; label: string; hint: string }> = [
  { value: "hive", label: "Hive 真实账单", hint: "当前账号最近一张账单，整张原样送出" },
  { value: "minimal", label: "最小数据", hint: "同一张账单只取第一条明细，不带发票号与折扣" },
  { value: "shopdemo", label: "其他发票", hint: "类 Shopify 订单：USD、8% 单行税、已支付" },
];

/** 发票联调台：三个 tab、只读载荷预览、唯一可编辑项是收件邮箱 */
export function InvoiceLabClient({
  source,
  initialEmail,
  configured,
  sourceLabel,
}: {
  source: LabSource;
  initialEmail: string;
  configured: boolean;
  sourceLabel: string | null;
}) {
  const [kind, setKind] = useState<LabKind>("hive");
  const [email, setEmail] = useState(initialEmail);
  const [resend, setResend] = useState(false);
  const [state, formAction, pending] = useActionState(sendTestInvoiceAction, initialState);

  const blockedByInvoice = kindNeedsInvoice(kind) && !source.invoice;

  const preview = useMemo(() => {
    try {
      return JSON.stringify(buildLabPayload(kind, source, email.trim(), resend), null, 2);
    } catch (error) {
      return error instanceof Error ? error.message : "无法构造载荷";
    }
  }, [kind, source, email, resend]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />

      <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-1.5 sm:max-w-sm">
            <Label htmlFor="lab-email">收件邮箱</Label>
            <Input
              id="lab-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              测试发票只会发到这个地址；三个 tab 共用。
            </p>
          </div>

          <p className="text-xs text-muted-foreground sm:text-right">
            {sourceLabel ?? "暂无可用账单"}
            <br />
            每次发送消耗 1 篇 Rendlet 额度
          </p>
        </div>

        {!configured && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            未配置 INVOICE_WEBHOOK_URL / INVOICE_WEBHOOK_TOKEN，无法发送。
          </p>
        )}
      </section>

      <Tabs value={kind} onValueChange={(value) => setKind(value as LabKind)}>
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-border/70 pb-2">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="pt-4">
            <p className="text-sm text-muted-foreground">{tab.hint}</p>
          </TabsContent>
        ))}
      </Tabs>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">实际发送的载荷（只读）</h3>
          <span className="text-xs text-muted-foreground">所见即所发</span>
        </div>
        <pre className="max-h-[420px] overflow-auto rounded-xl border border-border/80 bg-muted/30 p-4 font-mono text-xs leading-relaxed">
          {preview}
        </pre>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="resend"
            checked={resend}
            onChange={(event) => setResend(event.target.checked)}
            className="size-4 rounded border-border"
          />
          强制重发（resend）—— 同 id 已发送过时升 revision 而不是被去重拦下
        </label>

        <Button
          type="submit"
          variant="brand"
          disabled={pending || !configured || blockedByInvoice}
          className="min-h-11 sm:min-h-0"
        >
          <Send className="size-4" aria-hidden />
          {pending ? "发送中…" : "发送测试发票"}
        </Button>
      </section>

      {blockedByInvoice && (
        <p className="text-sm text-muted-foreground">
          当前没有可用账单，该 tab 暂不可发送。请先在账单页生成一张账单。
        </p>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state.response && <ResultPanel response={state.response} />}
    </form>
  );
}

const STATUS_TONE: Record<string, string> = {
  sent: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
  duplicate: "border-amber-500/30 bg-amber-500/5 text-amber-700",
  error: "border-destructive/30 bg-destructive/5 text-destructive",
};

function ResultPanel({ response }: { response: LabResponse }) {
  const body = asRecord(response.body);
  const outcome = body?.duplicate === true ? "duplicate" : response.ok ? "sent" : "error";
  const pdfUrl = typeof body?.pdf_url === "string" ? body.pdf_url : null;
  const revision = typeof body?.revision === "number" ? body.revision : null;

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[outcome]}`}>
          HTTP {response.status}
          {outcome === "duplicate" ? " · 已发送过，本次未重发" : ""}
        </span>
        {revision !== null && (
          <span className="text-xs text-muted-foreground">revision {revision}</span>
        )}
        <span className="text-xs text-muted-foreground">{response.durationMs} ms</span>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
          >
            打开 PDF
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>

      <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {JSON.stringify(response.body, null, 2)}
      </pre>
    </section>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
