import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { composeNotification, markNotificationRead } from "../domain/composer";
import type { Notification, NotificationChannel } from "../domain/types";

/**
 * NotificationApplicationService — 站内通知编排。
 * 事件订阅（预订/账单）写入通知；会员可查询与标记已读。
 */

export type SendNotificationInput = {
  memberId: string;
  title: string;
  content: string;
  channel?: NotificationChannel;
};

/** 创建通知（写入即站内已送达） */
export async function sendNotification(input: SendNotificationInput): Promise<Notification> {
  const n = composeNotification({
    id: crypto.randomUUID(),
    memberId: input.memberId,
    title: input.title,
    content: input.content,
    channel: input.channel,
    createdAt: new Date(),
  });
  await db.insert(notifications).values({
    id: n.id,
    memberId: n.memberId,
    title: n.title,
    content: n.content,
    channel: n.channel,
    status: n.status,
    createdAt: n.createdAt,
  }).run();
  return n;
}

/** 我的通知（最新在前） */
export async function listMyNotifications(memberId: string): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.memberId, memberId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
    .all();
  return rows as unknown as Notification[];
}

/** 未读数 */
export async function countUnread(memberId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.memberId, memberId), eq(notifications.status, "SENT")))
    .all();
  return rows.length;
}

/** 标记单条已读 */
export async function markAsRead(notificationId: string, memberId: string): Promise<void> {
  const row = await db.select().from(notifications).where(eq(notifications.id, notificationId)).get();
  if (!row || row.memberId !== memberId) throw new Error("通知不存在");
  const read = markNotificationRead(row as Notification);
  await db
    .update(notifications)
    .set({ status: read.status })
    .where(eq(notifications.id, notificationId))
    .run();
}

/** 全部标记已读 */
export async function markAllRead(memberId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ status: "READ" })
    .where(and(eq(notifications.memberId, memberId), eq(notifications.status, "SENT")))
    .run();
}
