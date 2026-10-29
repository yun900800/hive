# 蜂巢架构优化里程碑（M0–M5）

> 创建：2026-10-29
> 基线：UI 重构 P0–P7 已完成（`8daef48`）
> 前置：`docs/ui-optimization-milestones.md`（展示层已收敛，本计划处理平台层）
> 原则：先修正确性与数据安全，再谈性能与抽象；每个里程碑可独立上线、可回滚
> 用法：完成一项就把 `- [ ]` 改成 `- [x]`，并更新「进度总览」和该里程碑的「完成记录」

## 背景

UI 重构明确「只改展示层，不动 `domain/`、`application/`、server actions 的业务逻辑」。
该阶段结束后，代码层的主要风险集中在四处：

1. **事件驱动不可靠** —— Outbox 有队头阻塞与无重试，故障是静默的。
2. **计费有边界错误** —— 时区、跨账单封顶、迟到费用入账。
3. **并发与授权有缺口** —— 重复预订、越权 Action、JWT 角色不失效。
4. **数据访问按全表处理** —— 内存分页、N+1、页面访问触发全量出账。

本计划按**严重程度**排序（不是执行先后），M0 最严重。

## 评估口径

- 静态代码审阅：`src/modules/*`、`src/shared`、`src/lib`、`src/app` 页面与 Server Actions、Drizzle schema、`.github/workflows`、`vercel.json`、`deploy-summary.md`。
- **未执行** `npm test` / `npm run build` / 线上压测；因此标「推演」的结论需在 M0 用测试或实测确认。
- 严重度定义：
  - **P0** 已上线即可造成资金/数据错误，或故障不可见。
  - **P1** 规模增长或边界场景下必然出错。
  - **P2** 维护成本与演进阻力。
  - **P3** 交付质量与运维能力。

## 进度总览

| 里程碑 | 主题 | 严重度 | 任务数 | 已完成 | 状态 |
|---|---|---|---:|---:|---|
| M0 | 止血：事件可靠性、并发、时区、授权、环境 | P0 | 12 | 11 | 🟨 进行中（仅剩人工项 M0-11） |
| M1 | 计费一致性 | P1 | 8 | 0 | ⬜ 未开始 |
| M2 | 数据访问规模 | P1 | 8 | 0 | ⬜ 未开始 |
| M3 | 模块边界与可维护性 | P2 | 9 | 0 | ⬜ 未开始 |
| M4 | 交付质量与可观测性 | P2/P3 | 6 | 0 | ⬜ 未开始 |
| M5 | 业务闭环与运维 | P1/P3 | 7 | 0 | ⬜ 未开始 |
| **合计** |  |  | **50** | **11** | 🟨 进行中 |

状态图例：⬜ 未开始 / 🟨 进行中 / ✅ 完成

## 问题索引（严重度 → 里程碑）

| ID | 问题 | 严重度 | 里程碑 |
|---|---|---|---|
| P0-1 | Outbox 队头阻塞、FAILED 不重试、异常静默 | P0 | M0 |
| P0-2 | 预订冲突校验在事务外，可重复预订 | P0 | M0 |
| P0-3 | 计费/通行证按服务器本地时区（生产 UTC） | P0 | M0 |
| P0-4a | `markDeskNoShowAction` 缺少管理员/归属校验 | P0 | M0 |
| P0-4b | JWT 中的 `role` 只在登录时写入，降权不生效 | P0 | M0 |
| P0-4c | 生产管理员默认口令 + 公开仓库 | P0 | M0（人工项） |
| P0-5 | 缺少 `DATABASE_URL` 时静默回落本地 SQLite | P0 | M0 |
| P1-1 | 幂等不完整：通行证/通知/outbox 无去重键 | P1 | M1 |
| P1-2 | 灵活区月封顶在多张账单时失效 | P1 | M1 |
| P1-3 | 迟到消费明细永久不入账 | P1 | M1 |
| P1-4 | 管理端全表加载 + 内存分页；`listMyInvoices` 全表明细 | P1 | M2 |
| P1-5 | 资源可用性 N+1；出账 O(N) 且挂在页面访问上 | P1 | M2 |
| P1-6 | NO_SHOW 与通行证过期无调度 | P1 | M5 |
| P2-1 | bootstrap 靠手动 import，漏写即静默丢事件 | P2 | M3 |
| P2-2 | 跨上下文直接查表，破坏 ACL/OHS | P2 | M3 |
| P2-3 | `as unknown as` 强转，无 row→domain 映射 | P2 | M3 |
| P2-4 | `billing-app` / `booking-app` 过大 | P2 | M3 |
| P2-5 | 费率与文案硬编码重复 | P2 | M1 |
| P2-6 | Outbox 写入重复实现 | P2 | M3 |
| P2-7 | 无统一错误模型 | P2 | M3 |
| P3-1 | 无可观测性（日志/告警/追踪） | P3 | M4 |
| P3-2 | CI 不跑 typecheck/lint/test | P3 | M4 |
| P3-3 | 关键集成测试缺失 | P3 | M4 |
| P3-4 | 无数据保留/备份策略 | P3 | M5 |
| P3-5 | 无登录与接口限流 | P3 | M5 |

---

## M0 — 止血：事件可靠性、并发、时区、授权、环境 🟨

**目标**：先保证「不会算错钱、不会静默停摆、不会被越权操作」。这一层不引入新抽象，只做最小正确性修复。

### 任务

- [x] **M0-1 `outbox_event` 索引与查询顺序**
  - 迁移：`CREATE INDEX outbox_event_status_idx ON outbox_event(status, id)`（`drizzle/0007_*.sql`）
  - `src/shared/outbox.ts` 的 PENDING 查询改 `orderBy(asc(outboxEvents.id))`，并显式 `limit(batchSize)`
- [x] **M0-2 无订阅者事件不再永久占用批次**
  - 状态枚举增加 `SKIPPED`；`event-catalog.ts` 中显式标记 `noSubscriber: true` 的事件直接归档
  - 已登记但本进程未注册订阅者 → 保留 PENDING + 延迟 60s 重试 + `outbox.subscriber-missing` 告警
  - 日志改为结构化 JSON（`src/lib/logger.ts`）
- [x] **M0-3 FAILED 可重试 + 死信**
  - handler 抛错 → PENDING + 指数退避（1/2/4/8 分钟）+ `attempts` + `lastError`
  - `attempts >= MAX_ATTEMPTS(5)` → `DEAD`
  - 启动时自动把历史 `FAILED`（`attempts < 5`）拉回 PENDING
  - 管理端「冲刷事件」返回 `processed/skipped/failed/dead/deferred`
- [x] **M0-4 事件目录与订阅者断言**
  - 新增 `src/shared/event-catalog.ts`，15 个事件全部登记
  - `event-catalog.test.ts` 扫描源码断言：代码里出现的事件类型必须已登记；登记项必须有 owners 或 `noSubscriber`
- [x] **M0-5 预订写入原子化**
  - 新增 `resource_lock` 表；`withResourceLock()` 先对资源行 upsert（强制写事务），锁内再校验冲突并插入
  - `createDeskBooking` / `createRoomBooking` 的「查冲突 + 插入 + 写 outbox」在同一事务内
  - 附带 `SQLITE_BUSY` 重试（3 次，20/40/80ms）
- [x] **M0-6 灵活区会话唯一性**
  - `flex_session_active_member_idx`：`UNIQUE(memberId) WHERE status = 'ACTIVE'`
  - `startFlexSession` 捕获唯一约束冲突并转成「你已有在场会话，请先离场」
- [x] **M0-7 业务时区统一**
  - 新增 `src/shared/clock.ts`：`BUSINESS_TZ`、`monthKey`、`monthRange`、`startOfDay`、`endOfDay`、`businessDateKey`、`addMonthsInBusinessTz`
  - 已替换：`billing-app.ts`、`access-subscribers.ts`、`membership-app.ts`（订阅结束日）、`membership/domain/subscription.ts`（按天折算）、月度出账路由、会员出账 Action、管理端账单页
  - `clock.test.ts` 固定断言 UTC 时间戳，不依赖运行机器时区
- [x] **M0-8 `markDeskNoShow` 授权补齐**
  - Action 层改为 `adminGuardError()`（管理员专用）
  - `booking-app.markDeskNoShow(bookingId, actor)` 增加归属校验；`desk-no-show-authz.test.ts` 覆盖他人/本人/管理员三种情况
- [x] **M0-9 角色变更即时生效**
  - 采用方案 B：`user.sessionVersion` + JWT `sv` 比对，版本不一致返回 `null` 强制重新登录
  - `setMemberRoleAction` 递增 `sessionVersion`；进程内 30 秒快照缓存摊掉每请求主键查询
  - 旧 token 无 `sv` 时直接采纳当前版本，避免升级瞬间全员登出
- [x] **M0-10 环境变量校验**
  - 新增 `src/lib/env.ts`（zod）；生产运行时强制 `DATABASE_URL`、`AUTH_SECRET`
  - 移除 `lib/db/index.ts` 的生产本地文件回落（构建期仍允许回落，避免 `next build` 失败）
  - `CRON_SECRET` 缺失改为启动告警而非抛错（避免升级瞬间整站 500），见「实施备注」
- [ ] **M0-11 生产账号与仓库（人工项）**
  - 修改 `admin@hive.com` 默认口令
  - 评估公开仓库是否保留；保留则轮换 Turso Token 与 `AUTH_SECRET`，并把「URL 内嵌 token」改为 `DATABASE_AUTH_TOKEN`
- [x] **M0-12 M0 回归测试**
  - 队头阻塞：50 条 `noSubscriber` + 1 条 `invoice-issued`，两轮 dispatch 内后者必须 PROCESSED
  - 重试：handler 抛错 → PENDING（attempts=1、lastError、nextAttemptAt）→ 达上限 DEAD
  - 并发：`Promise.allSettled` 两个 `createRoomBooking` 只成功一个；两个 dispatch 并发不重复消费
  - 时区：月初 00:30、月末 23:59、跨年 `monthKey/monthRange/endOfDay`
  - 授权：非管理员调用 NoShow 被拒
  - 环境：生产缺 `DATABASE_URL`/`AUTH_SECRET` 启动失败，构建期跳过

### 实施备注（与原始任务的偏差）

1. **「无订阅者」拆成两种语义**：目录显式声明 `noSubscriber` → `SKIPPED`；
   已登记但本进程漏注册 → 保留 `PENDING` + 延迟重试（不消耗 attempts）。
   这样既清理了永久滞留，又不会把「某个入口漏 import bootstrap」误判成死信。
2. **未做进程内 in-flight 去重**：并发正确性由 `UPDATE ... RETURNING` 原子认领保证，
   去重只是延迟优化，且会干扰并发测试；由 M1 去掉重复调用更彻底。
3. **`CRON_SECRET` 只告警**：硬失败会让缺少该变量的部署整体不可用；
   定时任务缺密钥的表现是 403，已用 `env.cron-secret-missing` 显式记录。
4. **迁移 0007 删除了重复的 `invoice_line_item.occurredAt` ALTER**：
   手写的 0006 没有 snapshot，drizzle-kit 会重复生成；删除后 snapshot 仍包含该列，后续 diff 正常。
5. **本地开发库用 `drizzle-kit push` 同步**（历史库只有 5 条迁移记录，直接 migrate 会在 0005/0006 重复加列）。
   生产 Turso 仍需在执行 `npm run db:migrate` 后才可上线本批代码。

### 涉及文件

- `src/shared/outbox.ts`
- `src/lib/db/schema/outbox.ts`
- `src/lib/db/schema/auth.ts`
- `src/shared/event-catalog.ts`（新增）
- `src/shared/clock.ts`（新增）
- `src/lib/env.ts`（新增）
- `src/lib/logger.ts`（新增）
- `src/lib/db/index.ts`
- `src/modules/booking/application/booking-app.ts`
- `src/modules/booking/interface/actions/booking.ts`
- `src/modules/booking/infrastructure/db/schema.ts`
- `src/modules/billing/application/billing-app.ts`
- `src/modules/billing/interface/actions/{billing,admin-billing}.ts`
- `src/modules/access/application/access-subscribers.ts`
- `src/modules/membership/application/membership-app.ts`
- `src/modules/membership/domain/subscription.ts`
- `src/auth.ts`、`src/modules/membership/interface/actions/admin-member.ts`
- `src/app/api/billing/monthly-invoice/route.ts`、`src/app/(member)/billing/page.tsx`、`src/app/admin/billing/page.tsx`
- `drizzle/0007_*.sql`（新增迁移）
- 测试：`src/shared/{outbox,clock,event-catalog}.test.ts`、`src/lib/env.test.ts`、`src/modules/booking/application/desk-no-show-authz.test.ts`

### 技术要点

- **不要**用「无订阅者也标记 PROCESSED」这种掩盖问题的做法；必须是显式状态 + 可观测计数。
- 迁移必须兼容既有数据：`attempts` 默认 0，`lastError` 可空，历史 PENDING 的无人订阅事件一次性刷成 `SKIPPED`。
- 并发方案优先选**数据库约束**而不是应用层锁，Vercel 多实例下内存锁无效。
- 时区改动会影响历史账单口径：迁移脚本不重算历史账单，只在文档与报表里注明「M0 之前按 UTC 计月」。

### 验收

- 上述 5 类回归测试全部通过
- 手工验证：新建预订 → 签到 → 签退后，`usage_record` 立即出现且金额正确
- 构造 60 条滞留事件后，新事件仍能被消费
- 生产环境缺 `DATABASE_URL` 时启动直接失败并给出明确报错
- `npx tsc --noEmit`、`npx eslint`、`npm test` 通过

### 完成记录

- 日期：2026-10-29
- Commit：*(未提交)* —— 工作区仍含 P7 之后未提交的 UI 改动，需先分离再按块提交
- 验证结果：
  - `npx tsc --noEmit` 通过
  - `npm run lint` 0 error（存量 warning 未新增）
  - `npm test` 全部通过（22 → 25 个测试文件，177 个用例）
  - `npm run build` 通过（Next.js 16.2.12 / Turbopack）
- 上线前置（未执行，需人工/审批）：
  1. 生产 Turso 执行 `npm run db:migrate`（应用 `drizzle/0007_minor_dreaming_celestial.sql`）
  2. 回滚预案：旧代码不识别 `PROCESSING`，回滚前先
     `UPDATE outbox_event SET status='PENDING', lockedAt=NULL WHERE status='PROCESSING';`
  3. M0-11：修改默认管理员口令、轮换 `AUTH_SECRET` / Turso Token
- 说明：历史账单口径不重算；M0 之前按 UTC 计月，之后按北京时间计月

---

## M1 — 计费一致性 ⬜

**目标**：让「一笔消费只入账一次、不会被封顶绕过、不会因为迟到而漏账」。

### 任务

- [ ] **M1-1 `outbox_event` 持久化 `eventId` 并加唯一索引**（消费幂等基础）
- [ ] **M1-2 `gate_pass.bookingId` 唯一索引 + `createGatePass` 幂等**
  - 重复投递走 `onConflictDoNothing`，`revokeGatePassByBooking` 能覆盖全部（未来可能多渠道）
  - 评估 `generatePassCode` 的 8 位截断：改为完整随机段或加长，避免碰撞
- [ ] **M1-3 `notification` 幂等键**（`eventId` 或 `(memberId, dedupeKey)` 唯一）
- [ ] **M1-4 灵活区月封顶跨账单**
  - `applyFlexMonthlyCap` 入参改为「本月已入账 flex + 本张账单 flex + 月费」
  - 补测试：同月两次出账，累计 flex 费用 ≤ 月费 × 120%
- [ ] **M1-5 迟到费用入账**
  - 去掉 `occurredAt > invoiceCreatedAt` 的猜测式去重，统一以 `referenceId ∉ invoicedRefIds` 判定
  - 历史 `referenceId` 为空的明细行做一次性回填迁移
- [ ] **M1-6 费率与文案单一来源**
  - 删除 `billing-app.ts` 中写死的 `8000`，改用 `OVERTIME_RATE_PER_HOUR_CENTS`
  - 会议室费率缺失时抛错而非静默 `3000`
  - 描述文案抽到 `billing/domain/messages.ts`
- [ ] **M1-7 出账批处理**
  - `generateMonthlyInvoice` 只在末尾 dispatch 一次
  - 月度任务按会员分批（每批 20），单会员失败不影响整批
- [ ] **M1-8 从页面访问路径移除出账**
  - `ensureMonthlyInvoiceIfNeeded` 降级为「只读检查 + 标记待出账」，实际出账交给调度（M5）

### 涉及文件

- `src/lib/db/schema/outbox.ts`、`src/modules/access/infrastructure/db/schema.ts`、`src/modules/notification/infrastructure/db/schema.ts`
- `src/modules/billing/application/billing-app.ts`、`src/modules/billing/domain/rate-policy.ts`
- `src/modules/access/application/access-app.ts`
- `src/modules/notification/application/notification-app.ts`
- `src/app/api/billing/monthly-invoice/route.ts`

### 验收

- `design/` 中 ¥939 场景、封顶场景、迟到入账场景全部成为自动化测试
- 同一事件重放 3 次，`usage_record` / `gate_pass` / `notification` 行数不变
- 出账接口 P95 相比基线下降（记录改前改后数字）

### 完成记录

- 日期：*(待填)*
- Commit：*(待填)*

---

## M2 — 数据访问规模 ⬜

**目标**：把「全表进内存」改成「数据库做过滤与分页」，让数据量增长 100 倍时页面不变慢。

### 任务

- [ ] **M2-1 管理端账单页 SQL 分页**
  - 过滤（月/状态/会员）下推 `where`，排序 `orderBy(createdAt desc)`，`limit/offset`
  - 明细只查当前页 `invoiceId`（`inArray`）
  - 统计卡用聚合查询单独取，避免为了统计拉全表
- [ ] **M2-2 管理端通行页分页**（当前固定最近 200 条，明确「按页切片」还是「应用层分页」）
- [ ] **M2-3 会员端 `listMyInvoices` 去掉全表明细**
  - 先查本会员账单，再按 `invoiceId` 批量取明细
- [ ] **M2-4 我的预订页 id→名称改 join 或批量映射**（避免全量加载资源表）
- [ ] **M2-5 资源可用性去 N+1**
  - `findAvailableDesks/Rooms` 改为单条 `NOT EXISTS` 或一次性取出全部占用后内存比对（需先按时间窗过滤）
- [ ] **M2-6 补索引**
  - `notification(memberId, status)`
  - `access_log(memberId, accessTime)`
  - 复核 `usage_record(billingMonth)`、`invoice(status)`
- [ ] **M2-7 压测脚本**
  - 造 1 万工位预订 + 10 万 usage + 5 千账单，记录关键页面查询数与 P95
- [ ] **M2-8 管理端会员页迁 URL query**
  - 当会员数超过 500 时，客户端过滤改为服务端分页（保留当前 UI）

### 涉及文件

- `src/app/admin/billing/page.tsx`、`src/app/admin/access/page.tsx`、`src/app/admin/members/*`
- `src/modules/billing/application/billing-app.ts`
- `src/modules/booking/application/booking-app.ts`
- `src/app/(member)/bookings/page.tsx`
- 各模块 `infrastructure/db/schema.ts`

### 验收

- 账单页查询次数从 O(全表) 降为「1 次计数 + 1 次分页 + 1 次明细」
- 10 万 usage 数据集下账单页 P95 < 300ms（本地 SQLite 基准）
- SQL 执行计划中不再出现全表扫描（`EXPLAIN QUERY PLAN` 截图存档）

### 完成记录

- 日期：*(待填)*
- Commit：*(待填)*

---

## M3 — 模块边界与可维护性 ⬜

**目标**：让「加一个上下文/换一个存储」不需要改十个文件，让类型错误在编译期暴露。

### 任务

- [ ] **M3-1 统一 bootstrap 入口**
  - 新增 `src/modules/bootstrap.ts` 汇总注册；`instrumentation.ts` 或根 layout 统一导入
  - 移除各 Action 文件里的 `import ".../bootstrap"`（保留幂等）
- [ ] **M3-2 跨上下文只读 Port**
  - `facility` 暴露 `getMeetingRoomRate(roomId)`、`membership` 暴露 `getActivePlan(memberId)`
  - `billing` / `booking` 不再直接 import 对方 schema
- [ ] **M3-3 row → domain 映射层**
  - 各模块 `infrastructure/mappers.ts`，删除全部 `as unknown as`
- [ ] **M3-4 拆分应用服务**
  - `billing-app.ts` → `record-usage.ts` / `invoice.ts` / `payment.ts` / `queries.ts`
  - `booking-app.ts` → `desk.ts` / `room.ts` / `flex.ts` / `availability.ts`
  - 单文件 ≤ 200 行
- [ ] **M3-5 统一 Outbox 写入**
  - `membership-app.ts` 四处手写 insert 改为 `appendOutboxEvents`
- [ ] **M3-6 统一错误模型**
  - `DomainError { code, message }` + UI 文案映射；Action 不再直出 `e.message`
- [ ] **M3-7 业务规则补文档**
  - 「FIXED_DESK 是否绑定具体工位」需要在 `design/` 或本文件写明结论
- [ ] **M3-8 依赖方向检查**
  - 加脚本/测试断言：`domain/` 不 import next/drizzle；`application/` 不 import 其它上下文的 `infrastructure/`
- [ ] **M3-9 事件目录与代码同步校验**（与 M0-4 合并维护）

### 涉及文件

- `src/modules/**/application/*`、`src/modules/**/infrastructure/*`
- `src/modules/bootstrap.ts`（新增）
- `src/instrumentation.ts`（新增，如采用）
- `src/lib/errors.ts`（新增）

### 验收

- `grep "as unknown as" src` 结果为 0
- 依赖方向测试通过
- 新增一个事件类型时，只需改 `event-catalog.ts` + 一个订阅者文件

### 完成记录

- 日期：*(待填)*
- Commit：*(待填)*

---

## M4 — 交付质量与可观测性 ⬜

**目标**：让「出问题能被发现」，让「坏代码进不了主干」。

### 任务

- [ ] **M4-1 CI 门禁**
  - `.github/workflows/ci.yml`：`tsc --noEmit` → `eslint` → `vitest run` → `next build`
  - `package.json` 增加 `typecheck` 脚本
- [ ] **M4-2 结构化日志**
  - `src/lib/logger.ts` 输出 JSON 行（level、event、aggregateId、durationMs）
  - 覆盖：出账、dispatch、支付、预订状态流转
- [ ] **M4-3 dispatch 结果可查**
  - 每次 dispatch 记录一批统计（processed/skipped/failed/dead）到表或日志，管理端展示最近 20 次
- [ ] **M4-4 失败告警**
  - `DEAD` 事件数 > 0 或 dispatch 失败率 > 阈值时告警（邮件/Webhook 任选）
- [ ] **M4-5 补齐集成测试**
  - 授权矩阵（每个 Action × 角色）
  - 并发预订
  - 时区边界
  - 出账幂等
  - 分页正确性
- [ ] **M4-6 移除静默 catch**
  - `billing-app.ts` 的 `catch {}` 改为记录 + 重新抛出或返回可判定结果

### 验收

- 任一 PR 不通过 CI 无法合并
- 线上一次出账可在日志中按 `requestId` 还原完整链路
- 关键 Action 授权测试覆盖率 100%（以函数清单为准）

### 完成记录

- 日期：*(待填)*
- Commit：*(待填)*

---

## M5 — 业务闭环与运维 ⬜

**目标**：把「设计文档写了但没人执行」的规则真正跑起来，并补齐运维底线。

### 任务

- [ ] **M5-1 NO_SHOW 自动清扫**（每 5 分钟，预订开始 15 分钟后未签到 → NO_SHOW + 释放资源 + 通知）
- [ ] **M5-2 通行证过期任务**（每小时执行 `expireOldPasses`）
- [ ] **M5-3 Outbox 定时冲刷**（每分钟；Vercel Cron 优先，GitHub Actions 仅兜底）
- [ ] **M5-4 调度可靠性**
  - 任务执行记录表（job、lastRun、result、duration）
  - 失败重试与告警；避免「cron 静默失败」
- [ ] **M5-5 数据保留与备份**
  - `outbox_event` 已处理 30 天清理、`access_log` 180 天归档
  - Turso 备份/PITR 策略写入运维文档
- [ ] **M5-6 限流**
  - 登录/注册（按 IP+邮箱）、扫码、出账接口
- [ ] **M5-7 README 重写**
  - 架构图、模块边界、事件目录、常用命令、环境变量、运维手册、演示账号说明

### 验收

- 爽约 15 分钟后预订自动 NO_SHOW 且资源可再预订
- 连续 7 天无 DEAD 事件、无调度漏跑
- 新成员按 README 30 分钟内可本地跑通

### 完成记录

- 日期：*(待填)*
- Commit：*(待填)*

---

## 全局完成标准（每个里程碑都适用）

- `npx tsc --noEmit` 通过
- `npx eslint` 针对改动文件通过
- `npm test` 通过，且本里程碑新增测试覆盖其核心风险
- 涉及 schema 的改动必须提供迁移文件，不允许只用 `db:push`
- 涉及金额/时区/权限的改动必须在 PR 描述里写明「改前行为 / 改后行为 / 影响的历史数据」
- 更新本文件的复选框、进度总览、完成记录

## 暂不纳入

- 微服务拆分、消息中间件（Kafka/RabbitMQ）——单体模块化仍是正确选择
- 引入完整 CQRS/Event Sourcing——当前 Outbox + 状态机已足够
- 支付网关真实对接、闸机硬件对接——属功能开发
- 多租户改造——见 `design/multi-tenant-expansion-plan.md`，需单独立项
- UI 层继续打磨——已由 `docs/ui-optimization-milestones.md` 收口

## 推荐执行顺序

1. **M0**（必须整体完成后再上线新功能）
2. **M1** → **M5-3/M5-1**（计费正确 + 调度跑起来，业务闭环才算通）
3. **M2**（有真实数据量或性能反馈时提前）
4. **M3**（在 M1/M2 改动稳定后进行，避免同时大改）
5. **M4**（可与 M2/M3 并行，CI 越早接入收益越大）

每完成一个里程碑单独提交，提交信息示例：

- `fix(outbox): order pending events and retry failed deliveries`
- `fix(booking): make conflict check atomic and add flex session uniqueness`
- `fix(billing): use business timezone for month boundaries`
- `fix(billing): make flex cap and late usage accounting correct`
- `perf(admin): paginate invoices and access logs in SQL`
- `refactor(modules): introduce ports, mappers and unified bootstrap`
- `chore(ci): add typecheck, lint, test and build gates`
- `feat(ops): schedule no-show sweep, pass expiry and outbox dispatch`

## 附录：证据索引

| 结论 | 代码位置 |
|---|---|
| PENDING 查询无排序、无索引 | `src/shared/outbox.ts:44-49`、`src/lib/db/schema/outbox.ts` |
| 无订阅者保留 PENDING | `src/shared/outbox.ts:55-65` |
| 异常被吞 | `src/shared/outbox.ts:75` |
| FAILED 不再重试 | `src/shared/outbox.ts:87-97` |
| 4 类事件无订阅者 | `membership-app.ts:74`、`access-app.ts:46`、`booking-app.ts:187`、`membership-app.ts:309` |
| 冲突校验在事务外 | `src/modules/booking/application/booking-app.ts:81-88,124` |
| 时区取本地 | `billing-app.ts:33-44`、`access-subscribers.ts:51-55` |
| NoShow 无授权 | `src/modules/booking/interface/actions/booking.ts:108-123`、`booking-app.ts:243` |
| JWT 角色只在登录写入 | `src/auth.ts:75-92` |
| 本地 DB 静默回落 | `src/lib/db/index.ts:15-19` |
| 全表明细读取 | `billing-app.ts:604-624` |
| 管理端全量加载 | `src/app/admin/billing/page.tsx:45-49` |
| 可用性 N+1 | `booking-app.ts:619-646` |
| 封顶只看当前账单 | `billing-app.ts:455-474` |
| 迟到费用按时间过滤 | `billing-app.ts:328-332` |
| 超时费率硬编码 | `billing-app.ts:143` |
| 通行证编码截断 8 位 | `src/modules/access/domain/gate-pass.ts:46-48` |
| 默认管理员口令 | `deploy-summary.md:67` |
| CI 只跑 cron | `.github/workflows/*.yml`、`vercel.json` |
