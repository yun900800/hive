/**
 * Access bounded context — domain types.
 * Pure TypeScript, no framework dependencies. Mirrors design/coworking-hive.cml AccessContext.
 */

// ---------- 状态枚举 ----------

/** GatePassStatus — 通行证状态 */
export const GATE_PASS_STATUSES = ["ACTIVE", "USED", "EXPIRED", "REVOKED"] as const;
export type GatePassStatus = (typeof GATE_PASS_STATUSES)[number];

/** AccessDirection — 通行方向 */
export const ACCESS_DIRECTIONS = ["ENTRY", "EXIT"] as const;
export type AccessDirection = (typeof ACCESS_DIRECTIONS)[number];

/** AccessResult — 通行结果 */
export const ACCESS_RESULTS = [
  "GRANTED", // 通行允许
  "DENIED_NOT_STARTED", // 拒绝 - 未到生效时间（预订尚未开始）
  "DENIED_EXPIRED", // 拒绝 - 通行证已过期
  "DENIED_NO_BOOKING", // 拒绝 - 无有效通行证
  "DENIED_REVOKED", // 拒绝 - 通行证已撤销
  "DENIED_INVALID", // 拒绝 - 通行证不存在/非法
] as const;
export type AccessResult = (typeof ACCESS_RESULTS)[number];

// ---------- 聚合实体 ----------

/** GatePass — 门禁通行证（聚合根，一次通行授权记录） */
export type GatePass = {
  id: string;
  code: string; // 通行证编码（扫码时用）
  memberId: string;
  bookingId: string; // 关联预订单
  gatePassType: "DESK" | "ROOM" | "FLEX";
  validFrom: Date;
  validTo: Date;
  status: GatePassStatus;
  createdAt: Date;
};

/** AccessLogEntry — 通行记录（聚合根，一次闸机通行事件） */
export type AccessLogEntry = {
  id: string;
  gatePassId: string;
  memberId: string;
  gateName: string; // 闸机名称（MVP 简化 GateId）
  direction: AccessDirection;
  result: AccessResult;
  accessTime: Date;
};

// ---------- 领域事件载荷 ----------

/** GatePassCreated — 通行证已创建 */
export type GatePassCreatedPayload = {
  gatePassId: string;
  memberId: string;
  bookingId: string;
  validFrom: string;
  validTo: string;
};
