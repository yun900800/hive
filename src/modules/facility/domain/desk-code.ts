import type { DeskId } from "./types";

/**
 * DeskId code derivation — 工位编码，如 "B-12" = 楼层B + 区域1 + 编号2
 * 纯函数：给定楼层/区域/编号，生成统一的工位编码。
 */

export function buildDeskCode(floorCode: string, zoneCode: string, number: number): string {
  if (!/^[A-Za-z]$/.test(floorCode)) {
    throw new Error(`Invalid floor code: "${floorCode}" (expected single letter)`);
  }
  if (!/^\d+$/.test(String(zoneCode))) {
    throw new Error(`Invalid zone code: "${zoneCode}" (expected digits)`);
  }
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid desk number: ${number} (expected positive integer)`);
  }
  return `${floorCode.toUpperCase()}-${zoneCode}${number}`;
}

/** 解析工位编码为 DeskId 值对象，如 "B-12" → { floorCode: "B", zoneCode: "1", number: 2 }
 *  约定：区域编码为单数字（1-9），工位序号为其余数字。 */
export function parseDeskCode(code: string): DeskId {
  const match = /^([A-Za-z])\s*[-]?\s*(\d+)$/.exec(code.trim());
  if (!match || match[2].length < 2) {
    throw new Error(`Invalid desk code: "${code}" (expected format like "B-12")`);
  }
  const rest = match[2];
  return {
    floorCode: match[1].toUpperCase(),
    zoneCode: rest[0],
    number: Number(rest.slice(1)),
  };
}
