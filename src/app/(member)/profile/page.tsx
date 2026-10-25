import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";

import { auth } from "@/auth";
import {
  getMember,
  getActiveSubscription,
} from "@/modules/membership/application/membership-app";
import { formatYuan, formatDate } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { cancelSubscriptionAction } from "@/modules/membership/interface/actions/subscribe";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/empty-state";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-3 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member, sub] = await Promise.all([
    getMember(session.user.memberId),
    getActiveSubscription(session.user.memberId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="个人中心"
        description="查看会员资料、信用分与当前订阅，管理你的办公方案。"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="会员资料"
          description="账号信息与会员等级。"
        >
          <dl className="text-sm">
            <InfoRow label="姓名">{member?.name ?? "—"}</InfoRow>
            <InfoRow label="邮箱">{member?.email ?? "—"}</InfoRow>
            <InfoRow label="手机号">{member?.phone || "—"}</InfoRow>
            <InfoRow label="会员等级">
              {member ? (
                <StatusBadge kind="tier" value={member.tier} />
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="信用分">
              <span className="tabular-nums">
                {member?.creditScore ?? "—"}
              </span>
            </InfoRow>
          </dl>
        </SectionCard>

        <SectionCard
          title="当前订阅"
          description={
            sub ? "当前生效中的套餐与计费周期。" : "你还没有生效中的订阅。"
          }
        >
          {sub ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">当前套餐</p>
                  <p className="mt-1 text-lg font-semibold">
                    {labelOf("planType", sub.planType)}
                  </p>
                </div>
                <StatusBadge kind="subscription" value={sub.status} />
              </div>

              <dl className="text-sm">
                <InfoRow label="月费">
                  <span className="tabular-nums">
                    {formatYuan(sub.monthlyFeeCents)}
                  </span>
                </InfoRow>
                <InfoRow label="计费周期">
                  <span className="text-xs tabular-nums sm:text-sm">
                    {formatDate(sub.startDate)} ~ {formatDate(sub.endDate)}
                  </span>
                </InfoRow>
              </dl>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                <Link
                  href="/subscription"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  管理套餐
                </Link>
                <form action={cancelSubscriptionAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    取消当前套餐
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="还没有订阅"
              description="选择一款适合你的办公方案，开始使用蜂巢。"
              className="border-0 bg-transparent py-8"
              action={
                <Link
                  href="/subscription"
                  className={cn(
                    buttonVariants({ variant: "brand", size: "sm" })
                  )}
                >
                  选择套餐
                </Link>
              }
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
