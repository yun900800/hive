/**
 * NotificationComposer（纯函数）—— 通知内容组装与状态流转。
 * 各上下文通过事件触发通知创建。
 */

import type { Notification, NotificationChannel, NotificationStatus } from "./types";

export type ComposeInput = {
  id: string;
  memberId: string;
  title: string;
  content: string;
  channel?: NotificationChannel;
  createdAt: Date;
};

/** 创建通知（初始 IN_APP + SENT，即写入即送达站内） */
export function composeNotification(input: ComposeInput): Notification {
  return {
    id: input.id,
    memberId: input.memberId,
    title: input.title,
    content: input.content,
    channel: input.channel ?? "IN_APP",
    status: "SENT",
    createdAt: input.createdAt,
  };
}

/** 标记已读 */
export function markNotificationRead(n: Notification): Notification {
  if (n.status === "READ") return n;
  return { ...n, status: "READ" as NotificationStatus };
}

/** 组合预订确认通知 */
export function composeBookingConfirmation(params: {
  id: string;
  memberId: string;
  bookingType: string;
  resource: string;
  startTime: Date;
  endTime: Date;
}): Notification {
  return composeNotification({
    id: params.id,
    memberId: params.memberId,
    title: "预订成功",
    content: `你的${params.resource}预订成功：${formatRange(params.startTime, params.endTime)}。可在通行证页面查看入场凭证。`,
    createdAt: new Date(),
  });
}

/** 组合账单通知 */
export function composeInvoiceNotice(params: {
  id: string;
  memberId: string;
  billingMonth: string;
  totalCents: number;
}): Notification {
  return composeNotification({
    id: params.id,
    memberId: params.memberId,
    title: "新账单已出",
    content: `${params.billingMonth} 账单已生成，金额 ¥${(params.totalCents / 100).toFixed(2)}。请及时支付。`,
    createdAt: new Date(),
  });
}

function formatRange(start: Date, end: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = (x: Date) =>
    `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  return `${d(start)} ~ ${d(end)}`;
}
