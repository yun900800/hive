import Link from "next/link";
import { Check, Building2, CalendarCheck, ScanLine, Wallet } from "lucide-react";

/** 首页使用流程 —— 三步上手 */
export function HowItWorks() {
  const steps = [
    {
      icon: Building2,
      step: "01",
      title: "选择套餐并注册",
      desc: "灵活办公位 / 固定办公位 / 独立办公室，按团队规模自由选择",
    },
    {
      icon: CalendarCheck,
      step: "02",
      title: "预订工位或会议室",
      desc: "在线锁定时间，系统自动生成门禁通行证",
    },
    {
      icon: ScanLine,
      step: "03",
      title: "扫码通行，即用即走",
      desc: "门禁扫码入场，结束自动记录时长",
    },
    {
      icon: Wallet,
      step: "04",
      title: "月底自动出账",
      desc: "会员费 + 用量费自动汇总，账单透明可查",
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            四个步骤，<span className="text-brand">即刻入驻</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            从注册到开工，最快只需几分钟
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, desc }) => (
            <li
              key={step}
              className="relative rounded-2xl border border-border/60 bg-background p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand/12 text-brand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-mono text-2xl font-bold text-muted-foreground/30">
                  {step}
                </span>
              </div>
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** 首页差异化价值 —— 我们和普通共享办公的区别 */
export function Differentiators() {
  const items = [
    "事件驱动计费引擎，费用记录零人工干预",
    "超时 15 分钟免罚，给会员缓冲时间",
    "灵活区月封顶 ≤ 月费 120%，消费有上限",
    "通行证全生命周期管理：签发 / 使用 / 撤销 / 过期",
  ];

  return (
    <section className="border-y border-border/60 bg-brand-muted/40 py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              不止是工位，<span className="text-brand">更是效率</span>
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
              蜂巢把共享办公的每一个环节都做成自动化：预订即发通行证、扫码即计费、
              超时自动算价、月底自动出账。让团队把时间花在做事上，而不是行政琐事。
            </p>
            <ul className="mt-8 space-y-3">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-8 inline-flex h-11 items-center rounded-lg border border-brand/40 px-6 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              立即注册体验
            </Link>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background p-8 shadow-lg">
            <p className="text-sm font-medium text-muted-foreground">蜂巢月度账单示例</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <span className="text-sm">会员费（固定办公位）</span>
                <span className="font-semibold">¥899</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <span className="text-sm">会议室使用（2 小时 × ¥30）</span>
                <span className="font-semibold">¥60</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <span className="text-sm">工位使用费</span>
                <span className="text-sm text-muted-foreground">含在套餐内 ¥0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">本月合计</span>
                <span className="text-xl font-bold text-brand">¥959</span>
              </div>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              * 示例数据，实际以系统当月计费为准
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
