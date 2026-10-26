import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  DoorOpen,
  Hexagon,
  Wallet,
} from "lucide-react";

const FEATURES = [
  { icon: CalendarCheck2, label: "工位与会议室预订" },
  { icon: DoorOpen, label: "灵活区签到与离场" },
  { icon: Wallet, label: "账单、套餐与通行记录" },
];

const COPY = {
  login: {
    eyebrow: "会员登录",
    title: "欢迎回来",
    description: "登录后继续管理你的工位、会议室与账单。",
    switchText: "还没有账号？",
    switchLabel: "立即注册",
    switchHref: "/register",
  },
  register: {
    eyebrow: "会员注册",
    title: "加入蜂巢",
    description: "创建会员账号，开始预订工位与会议室。",
    switchText: "已有账号？",
    switchLabel: "去登录",
    switchHref: "/login",
  },
} as const;

export function AuthShell({
  mode,
  children,
}: {
  mode: keyof typeof COPY;
  children: ReactNode;
}) {
  const copy = COPY[mode];

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand p-10 text-brand-foreground lg:flex lg:flex-col xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-foreground/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-white/20 blur-3xl"
        />
        <Hexagon
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute -right-12 top-1/2 size-72 -translate-y-1/2 text-brand-foreground/10"
        />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-foreground/10 ring-1 ring-brand-foreground/15">
                <Hexagon className="size-6" aria-hidden />
              </span>
              <span>
                <span className="block text-lg font-bold tracking-tight">
                  蜂巢
                </span>
                <span className="block text-xs font-medium text-brand-foreground/70">
                  共享办公
                </span>
              </span>
            </Link>

            <div className="mt-16 max-w-md">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-foreground/70">
                Warm Hive Workspace
              </p>
              <h1 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight text-balance xl:text-4xl">
                把工位、会议室和账单，收进一个温暖的工作台。
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-brand-foreground/75">
                蜂巢把会员、预订、通行与计费放在同一处，让每一次到场都更简单。
              </p>
            </div>
          </div>

          <div className="mt-12 space-y-6">
            <ul className="space-y-3">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-brand-foreground/10 bg-brand-foreground/10 px-4 py-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-foreground/10">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-brand-foreground/60">
              蜂巢共享办公 · 会员 / 预订 / 计费 一体化平台
            </p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col px-6 py-6 sm:px-10 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
              <Hexagon className="size-4.5" aria-hidden />
            </span>
            <span className="text-sm font-bold tracking-tight">蜂巢</span>
          </Link>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            返回首页
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand-strong">
                {copy.eyebrow}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                {copy.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {copy.description}
              </p>
            </div>

            <div className="mt-8">{children}</div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {copy.switchText}{" "}
              <Link
                href={copy.switchHref}
                className="font-medium text-brand-strong underline-offset-4 hover:underline"
              >
                {copy.switchLabel}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/70 lg:hidden">
          蜂巢共享办公 · 会员 / 预订 / 计费 一体化平台
        </p>
      </main>
    </div>
  );
}
