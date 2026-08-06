import { Armchair, Presentation, Sparkles, ScanLine, Timer, FileText } from "lucide-react";

/** 首页服务特色 —— 六大核心能力卡片 */
export function Features() {
  const features = [
    {
      icon: Armchair,
      title: "固定工位",
      desc: "专属工位 7×24 可用，扫码签到即用，含在套餐内不另收费",
    },
    {
      icon: Presentation,
      title: "会议室预订",
      desc: "按小时计费，超时自动计费，15 分钟免罚期体验友好",
    },
    {
      icon: Sparkles,
      title: "灵活办公区",
      desc: "FLEX 会员随时入场，按实际在场时长计费，用多少付多少",
    },
    {
      icon: ScanLine,
      title: "门禁通行",
      desc: "预订即生成通行证，扫码进出，全程无感、安全可控",
    },
    {
      icon: Timer,
      title: "自动计费",
      desc: "事件驱动计费引擎，使用结束即刻生成费用记录，无需手动操作",
    },
    {
      icon: FileText,
      title: "月度账单",
      desc: "月底自动聚合当月所有费用，会员费 + 用量费一目了然",
    },
  ];

  return (
    <section className="border-t border-border/60 bg-muted/30 py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            为团队打造的<span className="text-brand">智能空间</span>解决方案
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            从预订到通行、从使用到计费，蜂巢用一套系统串起共享办公的全流程
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <article
              key={title}
              className="group rounded-2xl border border-border/60 bg-background p-6 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
            >
              <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand/12 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mb-2 text-lg font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
