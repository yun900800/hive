import { redirect } from "next/navigation";
import { Bell, Inbox } from "lucide-react";

import { auth } from "@/auth";
import {
  listMyNotifications,
  countUnread,
} from "@/modules/notification/application/notification-app";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotificationActions } from "./notification-actions";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";
import { EmptyState } from "@/components/patterns/empty-state";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [items, unread] = await Promise.all([
    listMyNotifications(memberId),
    countUnread(memberId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="通知中心"
        description={`预订确认、账单与系统通知都在这里。${
          unread > 0 ? `当前有 ${unread} 条未读` : "全部已读"
        }`}
        actions={
          unread > 0 ? <NotificationActions action="all" /> : undefined
        }
      />

      <section aria-label="通知概览" className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="未读通知"
          value={unread}
          icon={Bell}
          tone={unread > 0 ? "warning" : "default"}
          hint={unread > 0 ? "需要你处理" : "没有未读通知"}
        />
        <StatCard
          label="全部通知"
          value={items.length}
          icon={Inbox}
          hint="最近的通知记录"
        />
      </section>

      <SectionCard
        title="通知列表"
        description={`共 ${items.length} 条，未读通知会以品牌色标记。`}
        bodyClassName="p-0"
      >
        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="暂无通知"
            description="预订确认、账单与系统通知会出现在这里。"
            className="border-0 bg-transparent"
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {items.map((notification) => {
              const isUnread = notification.status !== "READ";

              return (
                <li
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-4",
                    !isUnread && "opacity-70"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      isUnread ? "bg-brand" : "bg-muted-foreground/30"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {notification.title}
                      </p>
                      {isUnread && (
                        <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-ink ring-1 ring-inset ring-brand/30">
                          未读
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {notification.content}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatDateTime(notification.createdAt)}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="shrink-0">
                      <NotificationActions
                        action="one"
                        id={notification.id}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
