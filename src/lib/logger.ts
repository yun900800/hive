/**
 * 极简结构化日志。
 *
 * 为什么不用 console.log 直接打字符串：
 *  - Vercel / 本地都能按 JSON 字段过滤（event、eventId、memberId）；
 *  - 出账、事件分发这类"静默失败"场景必须留下可检索痕迹。
 *
 * M4 会在此基础上接入告警与请求追踪（requestId）；此处只保证不丢信息。
 */

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

function write(level: LogLevel, event: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info(event: string, fields: LogFields = {}): void {
    write("info", event, fields);
  },
  warn(event: string, fields: LogFields = {}): void {
    write("warn", event, fields);
  },
  error(event: string, fields: LogFields = {}): void {
    write("error", event, fields);
  },
};
