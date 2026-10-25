import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { listPlans } from "@/modules/membership/application/membership-app";
import { formatYuan } from "@/lib/format";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/empty-state";
import { cn } from "@/lib/utils";

export default async function PlansPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const plans = await listPlans();
  const activeCount = plans.filter((plan) => plan.isActive).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="套餐管理"
        description={`会员订阅的套餐目录。当前共 ${plans.length} 个套餐，${activeCount} 个启用中。`}
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="还没有套餐"
          description="套餐目录需要在种子数据或后续版本中配置。"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border border-border/80 bg-card p-5 ring-1 ring-foreground/[0.02]",
                !plan.isActive && "opacity-60"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge kind="planType" value={plan.planType} />
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    plan.isActive
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-muted text-muted-foreground ring-border"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      plan.isActive ? "bg-emerald-500" : "bg-muted-foreground/50"
                    )}
                  />
                  {plan.isActive ? "启用中" : "已停用"}
                </span>
              </div>

              <h2 className="mt-3 text-base font-semibold">{plan.name}</h2>

              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {formatYuan(plan.monthlyFeeCents)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / 月
                </span>
              </p>

              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                {plan.description}
              </p>

              <ul className="mt-4 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                {plan.freeFlexHours > 0 ? (
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>含每月 {plan.freeFlexHours} 小时灵活区免费额度</span>
                  </li>
                ) : (
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span>灵活区按实际使用计费</span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                  <span>账单按月统一结算</span>
                </li>
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
