import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** 首页 CTA —— 收尾转化区 */
export function CtaBanner() {
  return (
    <section className="py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand-muted/60 via-background to-brand-muted/40 px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,var(--brand-muted),transparent_50%)]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              准备好加入蜂巢了吗？
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              免费注册即可体验预订、通行、计费全流程。灵活工位从
              ¥499/月起，即刻开启高效办公。
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-8 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
              >
                免费注册
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-8 text-sm font-semibold transition-colors hover:bg-muted"
              >
                已有账号，登录
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
