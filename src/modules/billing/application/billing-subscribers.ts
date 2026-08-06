/**
 * Billing 事件订阅 — 注册到 Outbox 分发器。
 * 导入本文件即完成事件驱动计费的接线（服务端/脚本启动时调用一次）。
 */

import { registerEventHandler } from "@/shared/events";
import {
  recordDeskUsage,
  recordRoomUsage,
  recordFlexUsage,
  recordMembershipFee,
} from "./billing-app";

/** 订阅 Booking / Membership 事件 → 写入 usage_records */
export function registerBillingSubscribers(): void {
  registerEventHandler("booking.booking-checked-out", async (payload) => {
    const p = payload as { bookingId: string; memberId: string; checkOutTime: string };
    await recordDeskUsage(p);
  });

  registerEventHandler("booking.room-booking-completed", async (payload) => {
    const p = payload as {
      roomBookingId: string;
      memberId: string;
      roomId: string;
      bookedStartTime: string;
      bookedEndTime: string;
      actualStartTime: string;
      actualEndTime: string;
    };
    await recordRoomUsage(p);
  });

  registerEventHandler("booking.flex-session-ended", async (payload) => {
    const p = payload as {
      sessionId: string;
      memberId: string;
      checkOutTime: string;
      actualDurationMs: number;
    };
    await recordFlexUsage(p);
  });

  registerEventHandler("membership.subscription-changed", async (payload) => {
    const p = payload as { memberId: string; planType: string; monthlyFeeCents: number };
    await recordMembershipFee(p);
  });
}
