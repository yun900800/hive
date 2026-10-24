import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Award,
  CalendarPlus,
  CreditCard,
  DoorOpen,
  Gauge,
  Sparkles,
  Wallet,
} from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getMember,
  getActiveSubscription,
  listPlans,
} from "@/modules/membership/application/membership-app";
import { getOutstandingBalance } from "@/modules/billing/application/billing-app";
import { formatYuan, formatDate } from "@/lib/format";
import { labelOf } from "@/lib/labels";

const QUICK_ACTIONS = [
  {
    href: "/bookings/desk",
    label: "订工位",
    description: "固定工位与独立办公室",
    icon: CalendarPlus,
  },
  {
    href: "/bookings/room",
    label: "订会议室",
    description: "按小时计费，超时提醒",
    icon: DoorOpen,
  },
  {
    href: "/flex",
    label: "灵活区签到",
    description: "到场计时，按实际使用付费",
    icon: Sparkles,
  },
];

export default async function MemberDashboardPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [member, sub, plans, outstanding] = await Promise.all([
    getMember(memberId),
    getActiveSubscription(memberId),
    listPlans(),
    getOutstandingBalance(memberId),
  ]);

  const currentPlan = sub
    ? plans.find((plan) => plan.planType === sub.planType)
    : undefined;
  const planName = sub ? (currentPlan?.name ?? labelOf("planType", sub.planType)) : null;

  return (
    <div className="space-y-10">
      <PageHeader
        title={`你好，${member?.name ?? "会员"}`}
        description="这里汇总了你的会员权益、预订入口与账单状态。"
        actions={
          <>
            <Link
              href="/bookings/desk"
              className={cn(buttonVariants({ variant: "brand" }))}
            >
              订工位
            </Link>
            <Link
              href="/bookings/room"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              订会议室
            </Link>
          </>
        }
      />

      <section
        aria-label="账户概览"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="会员等级"
          value={labelOf("tier", member?.tier)}
          icon={Award}
          tone="brand"
          hint="等级影响折扣与预订优先级"
        />
        <StatCard
          label="信用分"
          value={member?.creditScore ?? "—"}
          icon={Gauge}
          hint="按时到场、按时支付可保持高分"
        />
        <StatCard
          label="当前套餐"
          value={planName ?? "未订阅"}
          icon={Wallet}
          hint={
            sub
              ? `${formatYuan(sub.monthlyFeeCents)} / 月 · 至 ${formatDate(sub.endDate)}`
              : "选择套餐后即可开始预订"
          }
        />
        <StatCard
          label="待付账单"
          value={formatYuan(outstanding)}
          icon={CreditCard}
          tone={outstanding > 0 ? "warning" : "success"}
          hint={outstanding > 0 ? "建议尽快完成支付" : "暂无待支付账单"}
        />
      </section>

      <section aria-label="快捷操作" className="grid gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-strong"
                aria-hidden
              />
            </Link>
          );
        })}
      </section>

      <SectionCard
        title="当前订阅"
        description="套餐到期前 7 天会提醒续费，可随时升级。"
        action={
          <Link
            href="/subscription"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            管理套餐
          </Link>
        }
      >
        {sub ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold">{planName}</p>
                <StatusBadge kind="subscription" value={sub.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(sub.startDate)} 至 {formatDate(sub.endDate)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatYuan(sub.monthlyFeeCents)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / 月
                </span>
              </p>
              {currentPlan && (
                <p className="text-xs text-muted-foreground">
                  含每月 {currentPlan.freeFlexHours} 小时灵活区额度
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              你还没有生效中的订阅。选择下方套餐后即可预订工位与会议室。
            </p>
            <Link
              href="/subscription"
              className={cn(buttonVariants({ variant: "brand", size: "sm" }))}
            >
              选择套餐
            </Link>
          </div>
        )}
      </SectionCard>

      <section aria-labelledby="plans-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="plans-heading" className="text-base font-semibold">
              套餐目录
            </h2>
            <p className="text-sm text-muted-foreground">
              四种办公方式，按你的工作节奏选择。
            </p>
          </div>
          <Link
            href="/subscription"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline"
          >
            查看权益
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = sub?.planType === plan.planType;
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border border-border/80 bg-card p-5",
                  isCurrent && "ring-2 ring-brand/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge kind="planType" value={plan.planType} />
                  {isCurrent && (
                    <span className="text-[11px] font-medium text-brand-strong">
                      当前套餐
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{plan.name}</h3>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                  {formatYuan(plan.monthlyFeeCents)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / 月
                  </span>
                </p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {plan.description}
                </p>
                <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  含 {plan.freeFlexHours} 小时灵活区额度
                </p>
                <Link
                  href="/subscription"
                  className={cn(
                    buttonVariants({
                      variant: isCurrent ? "outline" : "secondary",
                      size: "sm",
                    }),
                    "mt-3 w-full"
                  )}
                >
                  {isCurrent ? "续费 / 变更" : "选择此套餐"}
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
