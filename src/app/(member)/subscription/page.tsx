import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import {
  listPlans,
  getActiveSubscription,
} from "@/modules/membership/application/membership-app";
import { formatYuan, formatDate } from "@/lib/format";
import { classifyPlanChange } from "@/modules/membership/domain/subscription";
import { labelOf } from "@/lib/labels";
import { SubscribeForm, type PlanVariant } from "./subscribe-form";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { cn } from "@/lib/utils";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [plans, activeSub] = await Promise.all([
    listPlans(),
    getActiveSubscription(session.user.memberId),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="套餐订阅与变更"
        description="选择最适合你工作节奏的共享办公套餐。支持随时升级或更换。"
      />

      {activeSub && (
        <SectionCard
          title="当前生效中的订阅"
          description="你正在享受该套餐对应的工位权益与灵活区额度。"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">
                  {labelOf("planType", activeSub.planType)}
                </span>
                <StatusBadge kind="subscription" value={activeSub.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                有效期：{formatDate(activeSub.startDate)} 至 {formatDate(activeSub.endDate)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-semibold tabular-nums">
                {formatYuan(activeSub.monthlyFeeCents)}
                <span className="text-sm font-normal text-muted-foreground"> / 月</span>
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">可选套餐目录</h2>
          <p className="text-sm text-muted-foreground">对比各套餐权益，选择或调整你的办公方案。</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.id === activeSub?.planId;
            const changeType = !activeSub
              ? "SUBSCRIBE"
              : isCurrent
                ? "CURRENT"
                : classifyPlanChange(activeSub.monthlyFeeCents, p.monthlyFeeCents);

            const variant: PlanVariant =
              changeType === "UPGRADE"
                ? "UPGRADE"
                : changeType === "DOWNGRADE"
                  ? "DOWNGRADE"
                  : changeType === "SAME"
                    ? "SAME"
                    : "SUBSCRIBE";

            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-6 transition-all",
                  isCurrent && "ring-2 ring-brand/50 shadow-xs"
                )}
              >
                {isCurrent && (
                  <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-brand-foreground shadow-xs">
                    <Sparkles className="size-3" aria-hidden />
                    当前方案
                  </span>
                )}

                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-brand-strong uppercase tracking-wider">
                      {labelOf("planType", p.planType)}
                    </span>
                    <h3 className="text-lg font-bold mt-0.5">{p.name}</h3>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">
                      {formatYuan(p.monthlyFeeCents)}
                    </span>
                    <span className="text-xs text-muted-foreground">/ 月</span>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>

                  <ul className="space-y-2 pt-2 text-xs text-muted-foreground border-t border-border/60">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-600 shrink-0" />
                      <span>每月含 {p.freeFlexHours} 小时灵活区额度</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-emerald-600 shrink-0" />
                      <span>尊享工位优先预订与专属客服</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60">
                  <SubscribeForm planId={p.id} disabled={isCurrent} variant={variant} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
