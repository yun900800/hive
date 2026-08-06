import { describe, expect, it } from "vitest";
import { buildDeskCode, parseDeskCode } from "./desk-code";

describe("desk-code", () => {
  it("生成工位编码 B-12", () => {
    expect(buildDeskCode("B", "1", 2)).toBe("B-12");
  });

  it("楼层小写自动转大写", () => {
    expect(buildDeskCode("a", "3", 8)).toBe("A-38");
  });

  it("非法楼层抛错", () => {
    expect(() => buildDeskCode("BB", "1", 2)).toThrow(/floor/);
  });

  it("非法编号抛错", () => {
    expect(() => buildDeskCode("B", "1", 0)).toThrow(/desk number/);
  });

  it("解析编码", () => {
    expect(parseDeskCode("B-12")).toEqual({
      floorCode: "B",
      zoneCode: "1",
      number: 2,
    });
  });

  it("解析非法编码抛错", () => {
    expect(() => parseDeskCode("XX")).toThrow(/Invalid desk code/);
  });
});
