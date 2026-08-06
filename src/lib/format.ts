/** 金额展示：分 → ¥xx.xx */
export function formatYuan(cents: number | null | undefined): string {
  if (cents == null) return "¥0.00";
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 日期展示：YYYY-MM-DD */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/** 时间展示：YYYY-MM-DD HH:mm */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 16).replace("T", " ");
}
