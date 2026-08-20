/**
 * Billing 事件订阅 — 注册到 Outbox 分发器。
 * 导入本文件即完成事件驱动计费的接线（服务端/脚本启动时调用一次）。
 */

import { registerEventHandler } from "@/shared/events";
import {
  recordDeskUsage,
  recordRoomUsage,
  recordRoomOvertime,
  recordFlexUsage,
  recordMembershipFee,
  recordBaseMembershipFee,
  recordUpgradeFee,
} from "./billing-app";

/** 订阅 Booking / Membership 事件 → 写入 usage_records */
export function registerBillingSubscribers(): void {
  registerEventHandler("booking.booking-checked-out", async (payload) => {
    const p = payload as { bookingId: string; memberId: string; checkOutTime: string };
    await recordDeskUsage(p);
  });

  // 会议室开始使用 → 按预定时长写入 ROOM_USAGE（资源已占用即计费）
  registerEventHandler("booking.room-booking-started", async (payload) => {
    const p = payload as {
      roomBookingId: string;
      memberId: string;
      roomId: string;
      bookedStartTime: string;
      bookedEndTime: string;
      actualStartTime: string;
    };
    await recordRoomUsage(p);
  });

  // 会议室完成使用 → 只补超时费（ROOM_USAGE 已在开始时入账）
  registerEventHandler("booking.room-booking-completed", async (payload) => {
    const p = payload as {
      roomBookingId: string;
      memberId: string;
      bookedEndTime: string;
      actualEndTime: string;
    };
    await recordRoomOvertime(p);
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

  // 升级 → 先补记当月基础月费（旧价），再记录差价
  registerEventHandler("membership.subscription-upgraded", async (payload) => {
    const p = payload as {
      memberId: string;
      planType: string;
      diffCents: number;
      subId: string;
      oldPlanType: string;
      oldMonthlyFeeCents: number;
    };
    await recordBaseMembershipFee({
      memberId: p.memberId,
      planType: p.oldPlanType,
      monthlyFeeCents: p.oldMonthlyFeeCents,
    });
    await recordUpgradeFee(p);
  });

  // 降级/平级 → 补记当月基础月费（旧价）；不产生新费用
  registerEventHandler("membership.subscription-downgraded", async (payload) => {
    const p = payload as {
      memberId: string;
      planType: string;
      oldMonthlyFeeCents: number;
      oldPlanType: string;
    };
    await recordBaseMembershipFee({
      memberId: p.memberId,
      planType: p.oldPlanType,
      monthlyFeeCents: p.oldMonthlyFeeCents,
    });
  });
}
