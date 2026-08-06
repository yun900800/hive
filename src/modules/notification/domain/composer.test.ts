/**
 * Notification 领域单测。
 */

import { describe, it, expect } from "vitest";
import {
  composeNotification,
  markNotificationRead,
  composeBookingConfirmation,
  composeInvoiceNotice,
} from "./composer";

describe("composeNotification", () => {
  it("默认 IN_APP + SENT", () => {
    const n = composeNotification({
      id: "n1",
      memberId: "m1",
      title: "测试",
      content: "内容",
      createdAt: new Date(),
    });
    expect(n.channel).toBe("IN_APP");
    expect(n.status).toBe("SENT");
  });
});

describe("markNotificationRead", () => {
  it("SENT → READ；幂等", () => {
    const n = composeNotification({ id: "n1", memberId: "m1", title: "t", content: "c", createdAt: new Date() });
    const read = markNotificationRead(n);
    expect(read.status).toBe("READ");
    expect(markNotificationRead(read).status).toBe("READ");
  });
});

describe("composeBookingConfirmation", () => {
  it("生成预订成功通知内容", () => {
    const n = composeBookingConfirmation({
      id: "n1",
      memberId: "m1",
      bookingType: "DESK",
      resource: "工位 B-12",
      startTime: new Date(2026, 7, 20, 9, 0),
      endTime: new Date(2026, 7, 20, 18, 0),
    });
    expect(n.title).toBe("预订成功");
    expect(n.content).toContain("工位 B-12");
    expect(n.content).toContain("2026-08-20 09:00");
  });
});

describe("composeInvoiceNotice", () => {
  it("生成账单通知，金额格式化", () => {
    const n = composeInvoiceNotice({ id: "n1", memberId: "m1", billingMonth: "2026-08", totalCents: 96900 });
    expect(n.title).toBe("新账单已出");
    expect(n.content).toContain("¥969.00");
  });
});
