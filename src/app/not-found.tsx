import Link from "next/link";
import { Home } from "lucide-react";
import { LostBee } from "@/components/not-found/lost-bee";

/** 卡通六边形点缀（纯 CSS 绘制） */
function Honeycomb({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className={`pointer-events-none absolute ${className}`}
    >
      <polygon
        points="50,6 93,28 93,72 50,94 7,72 7,28"
        fill="var(--brand-muted)"
        opacity="0.6"
      />
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      {/* 蜂蜜色氛围背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,var(--brand-muted),transparent_60%)]"
      />
      {/* 六边形点缀 */}
      <Honeycomb className="left-6 top-16 w-10 sm:left-16 sm:w-14" />
      <Honeycomb className="right-8 top-24 w-8 sm:right-20 sm:w-12" />
      <Honeycomb className="bottom-20 left-12 w-8 sm:left-24 sm:w-11" />
      <Honeycomb className="right-12 bottom-12 w-10 sm:right-28 sm:w-14" />

      <div className="relative flex flex-col items-center">
        <LostBee />

        <p className="mt-6 font-mono text-6xl font-bold tracking-tight text-brand sm:text-7xl">
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          哎呀，小蜜蜂迷路了
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          你访问的页面不存在，可能已被搬走或换了位置。
          <br className="hidden sm:block" />
          点击下方按钮，让小蜜蜂带你飞回蜂巢吧～
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <Home className="size-4" aria-hidden />
            返回首页
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-6 text-sm font-semibold transition-colors hover:bg-muted"
          >
            注册体验蜂巢
          </Link>
        </div>

        <p className="mt-10 text-xs text-muted-foreground/70">
          蜂巢共享办公 · 让每一寸空间都用起来
        </p>
      </div>
    </main>
  );
}
