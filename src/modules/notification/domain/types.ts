/**
 * Notification bounded context — domain types.
 * Pure TypeScript. Mirrors design/coworking-hive.cml NotificationContext.
 */

// ---------- 枚举 ----------

/** NotificationChannel — 发送渠道（MVP 仅 IN_APP） */
export const NOTIFICATION_CHANNELS = ["PUSH", "SMS", "EMAIL", "IN_APP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** NotificationStatus — 送达状态 */
export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// ---------- 聚合实体 ----------

/** Notification — 通知消息（聚合根） */
export type Notification = {
  id: string;
  memberId: string; // 接收会员
  title: string;
  content: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  createdAt: Date;
};

// ---------- 领域事件载荷 ----------

/** NotificationCreated — 通知已创建 */
export type NotificationCreatedPayload = {
  notificationId: string;
  memberId: string;
  title: string;
  content: string;
};
