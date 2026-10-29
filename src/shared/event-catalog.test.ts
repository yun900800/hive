import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KNOWN_EVENT_TYPES, getEventSpec } from "./event-catalog";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENT_PATTERN = /"(booking|membership|access|billing|payment)\.[a-z0-9-]+"/g;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

/** 扫描代码里出现的所有事件类型字面量 */
function collectEmittedEventTypes(): Set<string> {
  const types = new Set<string>();
  for (const file of collectSourceFiles(SRC_ROOT)) {
    if (file.endsWith("event-catalog.ts")) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(EVENT_PATTERN)) {
      types.add(match[0].slice(1, -1));
    }
  }
  return types;
}

describe("event catalog — 事件清单与代码保持一致", () => {
  it("每个在代码中出现的事件类型都已登记", () => {
    const emitted = [...collectEmittedEventTypes()];
    const unregistered = emitted.filter((type) => getEventSpec(type) === undefined);

    expect(emitted.length).toBeGreaterThan(0);
    expect(unregistered).toEqual([]);
  });

  it("已登记的事件都声明了负责模块，或明确标记为无人订阅", () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const spec = getEventSpec(type);
      expect(spec).toBeDefined();
      if (spec?.noSubscriber) continue;
      expect(spec?.owners.length, `${type} 未声明 owners`).toBeGreaterThan(0);
    }
  });
});
