import { describe, expect, it } from "vitest";
import { Money } from "@/shared/money";

describe("Money", () => {
  it("构建：整数分", () => {
    expect(Money.of(89900).format()).toBe("¥899.00");
  });

  it("从元构建", () => {
    expect(Money.fromYuan(899).cents).toBe(89900);
  });

  it("加法", () => {
    expect(Money.of(89900).add(Money.of(4000)).format()).toBe("¥939.00");
  });

  it("减法", () => {
    expect(Money.of(10000).subtract(Money.of(3000)).format()).toBe("¥70.00");
  });

  it("乘法（四舍五入到分）", () => {
    expect(Money.of(3333).multiply(3).cents).toBe(9999);
    expect(Money.fromYuan(9.999).multiply(2).cents).toBe(2000);
  });

  it("零值判断", () => {
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.of(-1).isNegative()).toBe(true);
  });

  it("跨币种运算抛错", () => {
    expect(() => Money.of(1, "CNY").add(Money.of(1, "USD"))).toThrow(
      /Currency mismatch/
    );
  });

  it("非法金额抛错", () => {
    expect(() => Money.of(1.5)).toThrow(/safe integer/);
  });
});
