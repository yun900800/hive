"use server";

import { z } from "zod";

import { adminGuardError } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { loadLabSource } from "@/modules/billing/application/invoice-lab";
import {
  buildLabPayload,
  type LabKind,
} from "@/modules/billing/domain/invoice-lab-payloads";

export type LabResponse = {
  ok: boolean;
  status: number;
  body: unknown;
  kind: LabKind;
  payload: Record<string, unknown>;
  sentAt: string;
  durationMs: number;
};

export type LabActionState = { error?: string; response?: LabResponse };

const formSchema = z.object({
  kind: z.enum(["hive", "minimal", "shopdemo"]),
  email: z.string().trim().email("邮箱格式不正确"),
  resend: z.boolean(),
});

/**
 * 发送一条测试发票到 n8n 工作流。
 *
 * 只给管理员用：每次点击消耗 1 篇 Rendlet 额度，并会真实发出邮件、写入审计表。
 * 载荷带 `test-` 前缀 id，不会与真实发票的去重记录相撞。
 */
export async function sendTestInvoiceAction(
  _prev: LabActionState,
  formData: FormData,
): Promise<LabActionState> {
  const guard = await adminGuardError();
  if (guard) return { error: guard };

  const parsed = formSchema.safeParse({
    kind: formData.get("kind"),
    email: String(formData.get("email") ?? ""),
    resend: formData.get("resend") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "参数不正确" };
  }

  const url = env.INVOICE_WEBHOOK_URL;
  const token = env.INVOICE_WEBHOOK_TOKEN;
  if (!url || !token) {
    return { error: "未配置 INVOICE_WEBHOOK_URL / INVOICE_WEBHOOK_TOKEN" };
  }

  const { kind, email, resend } = parsed.data;

  let payload: Record<string, unknown>;
  try {
    const source = await loadLabSource();
    payload = buildLabPayload(kind, source, email, resend);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "构造载荷失败" };
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-invoice-token": token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });

    return {
      response: {
        ok: res.ok,
        status: res.status,
        body: await readBody(res),
        kind,
        payload,
        sentAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { error: `请求未能完成：${reason}` };
  }
}

/** 工作流正常返回 JSON；反代出错时可能是 HTML，原样留下来便于排查 */
async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}
