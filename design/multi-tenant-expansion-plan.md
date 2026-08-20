# 蜂巢共享办公 — 多租户扩展方案（评估版）

> 版本：v0.1（评估稿）
> 日期：2026-08-07
> 状态：待讨论确认（仅评估，未实施）
> 配套阅读：`design/coworking-hive.cml`（限界上下文）、`DEVELOPMENT_PLAN.md`

---

## 一、背景

当前系统为**单体模块化**（6 个限界上下文 + 13 个聚合），用户量较少，尚未支持多租户。
本方案评估：当需要支持**多个空间运营商/门店**独立运营（各自管理设备、资源、会员、账单）时，
引入租户（Tenant）的完整影响面与实施路线。

> 注意：这里的"租户"指**运营这套系统的运营商/门店**，区别于 design 文档中的
> `CorporateAccount`（企业客户，是租户下面的一个会员类型），两者不可混淆。

---

## 二、现状关键事实（决定改动量）

| 事实 | 影响 |
|------|------|
| 全部 12+ 张业务表无任何 tenantId | 需逐表评估归属方式（见 §四） |
| 资源表 `desk.code` 等有**全局唯一索引** | 多租户后需改**租户内唯一**联合索引 `(tenantId, code)` |
| Auth 用 JWT 策略，jwt callback hydrate `role`/`memberId` | 加租户上下文改动集中在 `auth.ts` + `auth-guards.ts` |
| 应用服务直接 `db.select()` 全表直查，无 Repository 层 | 最大改动面：每个查询函数都要加租户过滤 |
| 领域层为纯函数（状态机/计费策略零框架依赖） | ✅ 几乎零改动，最大优势 |
| `seed/index.ts` 一次性种入全部数据 | 需先建租户，再给种子数据挂 tenantId |
| 管理员仅 `role: ADMIN`，无租户概念 | 需区分**平台超管** vs **租户管理员** |

---

## 三、分阶段实施路线

### 🅿️ 最小骨架（P0）— 约 10 个文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | **新增** `src/lib/db/schema/tenant.ts` | `tenant` 表（id/name/code/status/createdAt） |
| 2 | `src/lib/db/schema/auth.ts` | `users` 加 `tenantId` 列 |
| 3 | `src/modules/facility/infrastructure/db/schema.ts` | `desks`/`meetingRooms`/`flexZones`/`gates` 各加 `tenantId` + 改联合唯一索引 |
| 4 | `src/modules/membership/infrastructure/db/schema.ts` | `members` 加 `tenantId`；`plans` 加 `tenantId` |
| 5 | `src/auth.ts` | jwt/session callback 加 `tenantId` + 类型增强 |
| 6 | `src/lib/auth-guards.ts` | 新增 `getSessionTenantId()` / `requireTenant()` |
| 7 | `src/modules/facility/application/facility-app.ts` | 8 个函数全部加租户过滤 |
| 8 | `seed/index.ts` + `seed/data.ts` | 建默认租户 + 种子数据挂 tenantId |
| 9 | `src/app/admin/layout.tsx` | 校验 session 带 tenantId（防租户管理员查全量） |
| 10 | `drizzle` 迁移 | ALTER TABLE + 回填 + 重建索引 |

> **P0 效果**：资源（工位/会议室/区域/闸机）有租户归属，管理端按租户隔离，会员/预订/计费仍为全局。

### 🅿️ 完整落地（P1）— 累计约 25-30 个文件

| 层 | 文件 | 改动 |
|----|------|------|
| Schema | `booking`/`billing`/`access`/`notification` 4 个 schema 文件 | 业务表加 `tenantId`（desk_bookings, room_bookings, flex_sessions, usage_records, invoices, gate_passes, access_logs, notifications） |
| Application | `membership-app.ts` | registerMember 带租户（新用户注册归属策略见 §五） |
| | `booking-app.ts` | 12+ 个函数加租户过滤（创建时从 desk/zone 推导，查询时过滤） |
| | `billing-app.ts` | 8+ 个函数：usage/invoice 查询过滤 |
| | `access-app.ts` | 6+ 个函数：gatePass/scan/log 过滤 |
| | `notification-app.ts` | send/list 过滤 |
| Interface | 5 个模块的 `interface/actions/*.ts` | 传递租户上下文 |
| UI | admin 各页面 + 会员端页面 | 列表查询带租户；新增"租户管理"页 |
| Auth | `auth.ts` + `auth-guards.ts` | 超管（跨租户）/ 租户管理员（仅本租户）双角色 |

---

## 四、业务表租户归属设计（核心问题）

> 核心原则：**不是全局二选一，而是按每张表的业务语义单独决策。**
> 详见独立文档决策记录（§五后附判断标准）。

| 表 | 归属方式 | 理由 |
|----|---------|------|
| `desks` / `meeting_rooms` / `gates` / `flex_zones` | **加列** `tenantId` | 物理资产强归属单一租户，永远不变 |
| `desk_bookings` / `room_bookings` / `flex_sessions` | **加列** `tenantId` | 交易记录天然属于产生它的场地（可从资源/会员上溯） |
| `usage_records` / `invoices` | **加列** `tenantId` | 收入数据强归属，跟随会员/预订 |
| `gate_passes` / `access_logs` | **加列** `tenantId` | 安全审计数据，绝不能串租户 |
| `notifications` | **加列** `tenantId` | 随会员归属 |
| `members` | **关联表** `member_tenants`（✅ 已确认跨场地） | 会员可在多个场地有身份（深圳/成都），members 不带 tenantId |
| `plans` | **模板 + 租户覆盖**（✅ 已确认租户私有定价） | 平台模板 + `plan_tenant_pricing` 覆盖表，各租户定价不同 |
| `outbox_events` / auth 表 | 不加 | 技术机制，不需租户归属 |

---

## 五、实施前必须拍板的决策点

### 决策记录（2026-08-07 确认）

1. **套餐定价：租户级私有（✅ 已确认）**
   - 不同租户（深圳/成都）定价**不同**，`plans` 不能全局共享
   - 采用"**平台模板 + 租户定价覆盖**"：`plans`（平台模板，ownerTenantId = 平台/空）
     + `plan_tenant_pricing`（租户引用模板并覆盖价格）
   - 例如：深圳 FIXED_DESK ¥899/月，成都 FIXED_DESK ¥799/月

2. **会员归属：跨场地（✅ 已确认）**
   - 会员**可跨场地使用**：深圳会员到成都分店可正常入场/使用
   - 采用 `member_tenants` 关联表（members 本身不带 tenantId），支持一会员多场地身份

3. **计费归属：按"服务发生地"结算（✅ 已确认）**
   - **深圳算深圳，成都算成都**：消费发生在哪个租户的场地，收入就归哪个租户
   - `usage_records` / `invoices` 加 `tenantId`（收入归属租户）
   - 会员在成都使用会议室/灵活区 → 按**成都的费率**计费，收入归成都
   - 跨场地身份：`member_tenants` 中该会员在成都的"在场身份"用于校验准入

4. **管理端角色模型**
   - 平台超管（看所有租户、建租户、维护模板套餐）vs 租户管理员（仅本租户设备/会员/账单/定价）
   - 将 `role: ADMIN` 升级为 `role + tenantId` 组合或双角色枚举

---

## 六、判断标准：加列 vs 关联表（附文档备用）

- 这条记录**只能属于一个租户，且归属永远不变** → **加列**（denormalized）
- 这条记录**可能被多个租户共享/引用** → **关联表**（normalized）
- 这条记录**归属会变化** → 关联表（或可更新的列）
- 加列方案需防一致性破坏（如 A 租户会员订 B 租户工位）→ 应用层写时校验或事件校验

---

## 七、改动量估算

| 项目 | 估算 |
|------|------|
| 文件数 | P0 ≈ 10 个 / P1 ≈ 25-30 个 |
| 时间 | P0 约半天 / P1 约 2-3 天 |
| 风险点 | 🔴 唯一索引改动（全局唯一 → 租户内唯一，SQLite 需重建表）<br>🔴 直查函数漏加过滤（越权）<br>🟡 SQLite ALTER 限制（加列 OK，改索引重建表） |
| 测试 | 领域层纯函数测试不受影响；需补租户过滤集成测试 |

---

## 八、结论与建议

1. **先做 P0 骨架**：Tenant 表 + users.tenantId + session 上下文 + 资源表 tenantId
2. **不铺全表**：预订/计费/通行先不加列，靠"资源→会员→记录"链条上溯过滤
3. **注册走默认租户**：MVP 友好
4. **P0 时把索引设计对**（SQLite 改索引要重建表），避免返工
5. 等真正有第二个运营商入驻时再铺 P1

---

## 九、主场/客场计费模型（Home & Roaming Billing）—— 讨论记录

> 2026-08-07 讨论，待确认后固化为领域规则。
> 场景：深圳会员去成都分店使用场地，计费如何归属？

### 9.1 核心原则（已倾向确认）

> **费率看场地，身份看会员，收入归场地。**

| 维度 | 规则 |
|------|------|
| 套餐定价 | 租户级私有：深圳 FIXED_DESK ¥899 / 成都 ¥799（`plan_tenant_pricing` 覆盖表） |
| 会员身份 | 跨场地：`member_tenants` 关联表，深圳会员在成都有"在场身份" |
| 计费归属 | 按**消费发生地**结算：深圳算深圳，成都算成都，收入归场地 |
| 费率解析 | 按本次消费所属场地解析费率（非全局订阅费率） |

### 9.2 免费额度边界 —— 待决策（三种模式）

| 模式 | 规则 | 例子（深圳会员去成都） |
|------|------|------|
| **A. 权益随人走** | 深圳套餐免费额度全球通用 | 成都灵活区用深圳的 40h 免费额度 |
| **B. 权益归场地** | 只认本场地权益，客场按散客费率 | 成都灵活区按成都散客价计费 |
| **C. 混合（推荐）** | 主场权益只在主场用；客场有基础准入，超额按客场费率 | 可进场，会议室/超额灵活区按成都费率 |

> 推荐 C：主场权益留主场，客场按当地费率结算。
> 理由：深圳收的月费成本核算在深圳；使用成都资源就要付成都的钱。A/B 可作未来产品开关。

### 9.3 对现有代码的影响（P1）

```
现在：subscriptions.planType → rate-policy 全局费率表
将来：member_tenants[场地].plan → plan_tenant_pricing[场地] → 按场地解析费率
```

- 事件流：`booking.room-booking-completed` / `flex-session-ended` payload 需带 `tenantId`（消费发生地）
- Billing 订阅者按 payload.tenantId 归账（usage_records / invoices.tenantId = 收入归属）
- 跨场地准入校验：读 `member_tenants` 该会员在场地的在场身份
