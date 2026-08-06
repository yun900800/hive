/**
 * Access 事件订阅 — 预订确认发证 / 预订取消撤销。
 */

import { registerEventHandler } from "@/shared/events";
import { createGatePass, revokeGatePassByBooking } from "./access-app";

export function registerAccessSubscribers(): void {
  registerEventHandler("booking.booking-confirmed", async (payload) => {
    const p = payload as {
      bookingId: string;
      memberId: string;
      bookingType?: string;
      startTime: string;
      endTime: string;
    };
    await createGatePass({
      memberId: p.memberId,
      bookingId: p.bookingId,
      gatePassType: p.bookingType === "ROOM" ? "ROOM" : "DESK",
      validFrom: new Date(p.startTime),
      validTo: new Date(p.endTime),
    });
  });

  registerEventHandler("booking.booking-cancelled", async (payload) => {
    const p = payload as { bookingId: string };
    await revokeGatePassByBooking(p.bookingId);
  });

  // 灵活区入场 → 发 FLEX 通行证（授权当天有效）；离场 → 撤销
  registerEventHandler("booking.flex-session-started", async (payload) => {
    const p = payload as { sessionId: string; memberId: string; checkInTime: string };
    const checkInAt = new Date(p.checkInTime);
    await createGatePass({
      memberId: p.memberId,
      bookingId: p.sessionId,
      gatePassType: "FLEX",
      validFrom: checkInAt,
      validTo: endOfDay(checkInAt),
    });
  });

  registerEventHandler("booking.flex-session-ended", async (payload) => {
    const p = payload as { sessionId: string };
    await revokeGatePassByBooking(p.sessionId);
  });
}

/** 当天 23:59:59.999（灵活区按日通行） */
function endOfDay(d: Date): Date {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end;
}
