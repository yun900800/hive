/**
 * 业务时钟 —— 所有"按天/按月"的边界都必须经过这里。
 *
 * 背景：原先直接用 `Date#getFullYear/getMonth/setHours`，等于依赖进程本地时区。
 * 生产跑在 Vercel（UTC），业务在 Asia/Shanghai（UTC+8），导致：
 *  - 每月 1 日 00:00–08:00（北京时间）的消费被计入上个月；
 *  - 灵活区"当天有效"的通行证实际到次日 07:59 才失效。
 *
 * 中国无夏令时，因此固定偏移即可；不要用 Intl —— 结果会随运行环境变化，难测试。
 * 若未来支持多时区租户，把 offset 变成参数即可，调用方不用改。
 */

export const BUSINESS_TZ = "Asia/Shanghai";
export const BUSINESS_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 把 UTC 时间平移成"业务时区的墙上时间"（仍用 UTC getter 读取） */
function toBusinessWallClock(date: Date): Date {
  return new Date(date.getTime() + BUSINESS_TZ_OFFSET_MS);
}

/** 业务时区的月份键，如 "2026-03" */
export function monthKey(date: Date = new Date()): string {
  const wall = toBusinessWallClock(date);
  return `${wall.getUTCFullYear()}-${String(wall.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 业务时区的日期键，如 "2026-03-01" */
export function businessDateKey(date: Date = new Date()): string {
  const wall = toBusinessWallClock(date);
  return wall.toISOString().slice(0, 10);
}

/**
 * 业务时区某个月的起止（end 含当月最后一毫秒）。
 * @example monthRange("2026-02") // 2026-02-01T00:00:00+08:00 ~ 2026-02-28T23:59:59.999+08:00
 */
export function monthRange(month: string): { start: Date; end: Date } {
  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) throw new Error(`无效的月份格式（应为 YYYY-MM）: ${month}`);

  const year = Number(matched[1]);
  const monthNumber = Number(matched[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`无效的月份: ${month}`);
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1) - BUSINESS_TZ_OFFSET_MS);
  const end = new Date(Date.UTC(year, monthNumber, 1) - BUSINESS_TZ_OFFSET_MS - 1);
  return { start, end };
}

/** 业务时区当天的 00:00:00.000 */
export function startOfDay(date: Date): Date {
  const wall = toBusinessWallClock(date);
  const dayStartUtc = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate()
  );
  return new Date(dayStartUtc - BUSINESS_TZ_OFFSET_MS);
}

/** 业务时区当天的 23:59:59.999 */
export function endOfDay(date: Date): Date {
  return new Date(startOfDay(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * 在业务时区上加减月份，保留时分秒。
 * @example addMonthsInBusinessTz(new Date("2026-01-31T02:00:00Z"), 1) // 2026-02-28T02:00:00Z（+08:00 的 3/1 前夜→2/28）
 */
export function addMonthsInBusinessTz(date: Date, months: number): Date {
  const wall = toBusinessWallClock(date);
  const shifted = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth() + months,
    wall.getUTCDate(),
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
    wall.getUTCMilliseconds()
  );
  return new Date(shifted - BUSINESS_TZ_OFFSET_MS);
}

/**
 * 解析 `<input type="datetime-local">` 的值（不带时区），按业务时区（+08:00）解释。
 * 浏览器提交的是"墙上时间"，若直接 `new Date(value)`，在 UTC 服务器上会差 8 小时。
 * @example parseBusinessDateTime("2026-10-31T13:00") // 2026-10-31T05:00:00.000Z
 */
export function parseBusinessDateTime(value: string): Date | null {
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(value.trim());
  if (!matched) return null;
  const date = new Date(`${matched[1]}T${matched[2]}${matched[3] ?? ":00"}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
