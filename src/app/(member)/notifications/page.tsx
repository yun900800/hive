import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listMyNotifications,
  countUnread,
} from "@/modules/notification/application/notification-app";
import { formatDateTime } from "@/lib/format";
import { NotificationActions } from "./notification-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [items, unread] = await Promise.all([
    listMyNotifications(memberId),
    countUnread(memberId),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          <p className="text-sm text-muted-foreground">
            预订确认与账单通知都在这里。{unread > 0 ? `未读 ${unread} 条` : "全部已读"}
          </p>
        </div>
        {unread > 0 && <NotificationActions action="all" />}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无通知。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id} className={n.status === "READ" ? "opacity-60" : ""}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{n.title}</span>
                    {n.status !== "READ" && <Badge>未读</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.status !== "READ" && <NotificationActions action="one" id={n.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
