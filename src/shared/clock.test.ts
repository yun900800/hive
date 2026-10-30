import { describe, expect, it } from "vitest";
import {
  addMonthsInBusinessTz,
  businessDateKey,
  endOfDay,
  monthKey,
  monthRange,
  parseBusinessDateTime,
  startOfDay,
} from "./clock";

/**
 * 断言全部用绝对时间（ISO/UTC），与运行机器的时区无关。
 * 业务时区固定 Asia/Shanghai（UTC+8）。
 */
describe("clock — 业务时区边界", () => {
  it("monthKey 在北京时间 1 日 00:00 切换月份", () => {
    // 2026-02-28T15:59:59Z = 2026-02-28 23:59:59 +08:00
    expect(monthKey(new Date("2026-02-28T15:59:59Z"))).toBe("2026-02");
    // 2026-02-28T16:00:00Z = 2026-03-01 00:00:00 +08:00
    expect(monthKey(new Date("2026-02-28T16:00:00Z"))).toBe("2026-03");
  });

  it("monthRange 返回北京时间当月首尾", () => {
    const { start, end } = monthRange("2026-02");
    expect(start.toISOString()).toBe("2026-01-31T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-28T15:59:59.999Z");
  });

  it("monthRange 拒绝非法月份", () => {
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("2026/02")).toThrow();
  });

  it("startOfDay / endOfDay 以北京时间为准", () => {
    // 2026-03-01T00:30:00Z = 2026-03-01 08:30 +08:00
    const at = new Date("2026-03-01T00:30:00Z");
    expect(startOfDay(at).toISOString()).toBe("2026-02-28T16:00:00.000Z");
    expect(endOfDay(at).toISOString()).toBe("2026-03-01T15:59:59.999Z");
  });

  it("businessDateKey 返回北京时间日期", () => {
    expect(businessDateKey(new Date("2026-03-01T15:59:59Z"))).toBe("2026-03-01");
    expect(businessDateKey(new Date("2026-03-01T16:00:00Z"))).toBe("2026-03-02");
  });

  it("addMonthsInBusinessTz 保留北京时间的时分秒", () => {
    // 2026-01-15T02:00:00Z = 2026-01-15 10:00 +08:00
    const next = addMonthsInBusinessTz(new Date("2026-01-15T02:00:00Z"), 1);
    expect(next.toISOString()).toBe("2026-02-15T02:00:00.000Z");
  });

  it("parseBusinessDateTime 把无时区输入解释为北京时间", () => {
    expect(parseBusinessDateTime("2026-10-31T13:00")?.toISOString()).toBe(
      "2026-10-31T05:00:00.000Z"
    );
    expect(parseBusinessDateTime("2026-10-31T13:00:30")?.toISOString()).toBe(
      "2026-10-31T05:00:30.000Z"
    );
  });

  it("parseBusinessDateTime 拒绝非法输入", () => {
    expect(parseBusinessDateTime("2026-10-31 13:00")).toBeNull();
    expect(parseBusinessDateTime("2026-13-31T13:00")).toBeNull();
    expect(parseBusinessDateTime("")).toBeNull();
  });
});
