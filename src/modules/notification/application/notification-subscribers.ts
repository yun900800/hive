/**
 * Notification 事件订阅 — 预订确认 / 账单出账 → 站内通知。
 */

import { registerEventHandler } from "@/shared/events";
import { sendNotification } from "./notification-app";

export function registerNotificationSubscribers(): void {
  registerEventHandler("booking.booking-confirmed", async (payload) => {
    const p = payload as {
      bookingId: string;
      memberId: string;
      bookingType?: string;
      startTime: string;
      endTime: string;
    };
    const { composeBookingConfirmation } = await import("../domain/composer");
    const isRoom = p.bookingType === "ROOM";
    const n = composeBookingConfirmation({
      id: crypto.randomUUID(),
      memberId: p.memberId,
      bookingType: isRoom ? "ROOM" : "DESK",
      resource: isRoom ? "会议室" : "工位",
      startTime: new Date(p.startTime),
      endTime: new Date(p.endTime),
    });
    await sendNotification({ memberId: p.memberId, title: n.title, content: n.content });
  });

  registerEventHandler("billing.invoice-issued", async (payload) => {
    const p = payload as { memberId: string; billingMonth: string; totalCents: number };
    const { composeInvoiceNotice } = await import("../domain/composer");
    const n = composeInvoiceNotice({
      id: crypto.randomUUID(),
      memberId: p.memberId,
      billingMonth: p.billingMonth,
      totalCents: p.totalCents,
    });
    await sendNotification({ memberId: p.memberId, title: n.title, content: n.content });
  });
}
