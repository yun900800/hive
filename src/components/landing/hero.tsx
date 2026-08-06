import Link from "next/link";
import { ArrowRight, CalendarCheck, ScanLine, Wallet } from "lucide-react";

type HeroProps = {
  isAuthenticated: boolean;
};

/** 首页 Hero —— 蜂巢品牌主视觉 */
export function Hero({ isAuthenticated }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* 蜂蜜六边形背景点缀 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--brand-muted),transparent_45%),radial-gradient(circle_at_80%_10%,var(--brand-muted),transparent_40%),radial-gradient(circle_at_50%_90%,var(--brand-muted),transparent_50%)]"
      />
      <div className="container relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:pt-28">
        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand">
          <span className="inline-block size-2 rounded-full bg-brand" aria-hidden />
          一站式共享办公空间管理平台
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          蜂巢<span className="text-brand">共享办公</span>
          <br />
          让每一寸空间都用起来
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          灵活工位 · 会议室预订 · 门禁通行 · 自动计费
          <br className="hidden sm:block" />
          会员制共享办公空间，扫码即入，用完即走，账单一目了然
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
            >
              进入工作台
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
              >
                免费注册体验
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                登录
              </Link>
            </>
          )}
        </div>

        {/* 流程速览 */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: CalendarCheck, title: "在线预订", desc: "工位 / 会议室 / 灵活区" },
            { icon: ScanLine, title: "扫码通行", desc: "门禁自动放行，通行证秒生成" },
            { icon: Wallet, title: "自动计费", desc: "按实际使用，月底统一出账" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-5 backdrop-blur-sm"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
