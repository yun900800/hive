import { describe, it, expect } from "vitest";
import { aggregateLineItems, calculateInvoiceTotal, buildInvoice, markInvoicePaid, isInvoicePaid } from "./invoice";
import type { InvoiceLineItem } from "./types";

const HOUR_MS = 3_600_000;

function makeInvoice(tier = "BASIC", lineItems: InvoiceLineItem[] = [{ chargeType: "MEMBERSHIP_FEE", description: "套餐月费", amountCents: 89900 }]) {
  return buildInvoice({
    id: "inv-1",
    memberId: "m-1",
    billingMonth: "2026-08",
    lineItems,
    tier,
    dueDate: new Date(2026, 8, 10),
    createdAt: new Date(2026, 8, 1),
  });
}

describe("aggregateLineItems", () => {
  it("按费用类型聚合金额", () => {
    const lines = aggregateLineItems([
      { chargeType: "ROOM_USAGE", description: "会议室", amountCents: 3000 },
      { chargeType: "ROOM_USAGE", description: "会议室", amountCents: 3000 },
      { chargeType: "OVER_TIME_PENALTY", description: "超时费", amountCents: 4000 },
    ]);
    expect(lines).toHaveLength(2);
    const room = lines.find((l) => l.chargeType === "ROOM_USAGE")!;
    expect(room.amountCents).toBe(6000);
  });
});

describe("calculateInvoiceTotal", () => {
  it("BASIC 无折扣", () => {
    const lines: InvoiceLineItem[] = [
      { chargeType: "MEMBERSHIP_FEE", description: "", amountCents: 89900 },
      { chargeType: "ROOM_USAGE", description: "", amountCents: 3000 },
    ];
    const { totalBeforeDiscountCents, discountAppliedCents, totalCents } = calculateInvoiceTotal(lines, 1.0);
    expect(totalBeforeDiscountCents).toBe(92900);
    expect(discountAppliedCents).toBe(0);
    expect(totalCents).toBe(92900);
  });

  it("GOLD 9折", () => {
    const { totalCents, discountAppliedCents } = calculateInvoiceTotal(
      [{ chargeType: "MEMBERSHIP_FEE", description: "", amountCents: 89900 }],
      0.9
    );
    expect(totalCents).toBe(80910);
    expect(discountAppliedCents).toBe(8990);
  });
});

describe("buildInvoice", () => {
  it("生成 PENDING 账单并应用折扣", () => {
    const inv = makeInvoice("GOLD");
    expect(inv.status).toBe("PENDING");
    expect(inv.discountRate).toBe(0.9);
    expect(inv.totalCents).toBe(80910);
    expect(inv.paidAmountCents).toBe(0);
    expect(inv.paidAt).toBeNull();
  });

  it("小张场景：BASIC 会员 ¥899 + ¥30 + ¥40 = ¥969", () => {
    const inv = makeInvoice("BASIC", [
      { chargeType: "MEMBERSHIP_FEE", description: "FIXED_DESK 套餐月费", amountCents: 89900 },
      { chargeType: "ROOM_USAGE", description: "会议室使用费", amountCents: 3000 },
      { chargeType: "OVER_TIME_PENALTY", description: "会议室超时费", amountCents: 4000 },
    ]);
    expect(inv.totalCents).toBe(96900); // ¥969
    expect(inv.lineItems).toHaveLength(3);
  });
});

describe("markInvoicePaid", () => {
  it("PENDING → PAID，记录支付金额与时间", () => {
    const inv = makeInvoice();
    const paid = markInvoicePaid(inv, new Date(2026, 8, 2));
    expect(paid.status).toBe("PAID");
    expect(paid.paidAmountCents).toBe(inv.totalCents);
    expect(paid.paidAt).not.toBeNull();
    expect(isInvoicePaid(paid)).toBe(true);
  });

  it("PAID 不可重复支付", () => {
    const paid = markInvoicePaid(makeInvoice(), new Date());
    expect(() => markInvoicePaid(paid, new Date())).toThrow();
  });

  it("CANCELLED 不可支付", () => {
    const cancelled = { ...makeInvoice(), status: "CANCELLED" as const };
    expect(() => markInvoicePaid(cancelled, new Date())).toThrow();
  });
});
