/** 全站统一按北京时间展示（服务器与 Vercel 节点是 UTC） */
const DISPLAY_TIME_ZONE = "Asia/Shanghai";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 金额展示：分 → ¥1,234.00 */
export function formatYuan(cents: number | null | undefined): string {
  if (cents == null) return "¥0.00";
  return `¥${(cents / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 日期展示：YYYY-MM-DD（北京时间） */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return dateFormatter.format(value);
}

/** 时间展示：YYYY-MM-DD HH:mm（北京时间） */
export function formatDateTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return dateTimeFormatter.format(value);
}
