import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PlanRow } from "@/modules/membership/infrastructure/db/schema";

type PlanView = {
  id: string;
  name: string;
  planType: string;
  monthlyFeeCents: number;
  freeFlexHours: number;
  description: string | null;
};

function formatYuan(cents: number): string {
  return (cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function planHighlights(plan: PlanView): string[] {
  switch (plan.planType) {
    case "FLEX_DESK":
      return [
        "灵活区不限时段入场",
        `每月 ${plan.freeFlexHours} 小时免费额度`,
        "会议室按小时计费",
        "超时 15 分钟免罚",
      ];
    case "FIXED_DESK":
      return [
        "专属固定工位 7×24 可用",
        "工位费含在套餐内",
        "会议室按小时计费",
        "超时自动计费",
      ];
    case "PRIVATE_OFFICE":
      return [
        "独立办公室 + 基础座位",
        "适合 3-10 人小团队",
        "会议室按小时计费",
        "专属空间管理",
      ];
    case "VIRTUAL":
      return [
        "地址挂靠 + 收件服务",
        "灵活区 / 会议室按次付费",
        "低成本启动",
        "随时升级其他套餐",
      ];
    default:
      return [plan.description ?? "灵活组合办公方案"];
  }
}

/** 首页定价 —— 从套餐目录读取真实数据 */
export function Pricing({ plans }: { plans: PlanRow[] }) {
  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            透明定价，<span className="text-brand">按需选择</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            月费制会员，灵活区 / 会议室按实际使用计费，月底统一出账
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isPopular = plan.planType === "FIXED_DESK";
            const highlights = planHighlights(plan);
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  isPopular
                    ? "border-brand/60 bg-brand-muted/40 shadow-lg"
                    : "border-border/60 bg-background"
                }`}
              >
                {isPopular && (
                  <Badge className="absolute -top-2.5 right-4 bg-brand text-brand-foreground">
                    最受欢迎
                  </Badge>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-brand">
                    ¥{formatYuan(plan.monthlyFeeCents)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 月</span>
                </div>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                  {plan.description}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm leading-relaxed">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                      {h}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-8 inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    isPopular
                      ? "bg-brand text-brand-foreground hover:bg-brand/90"
                      : "border border-border bg-background hover:bg-muted"
                  }`}
                >
                  选择此套餐
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
