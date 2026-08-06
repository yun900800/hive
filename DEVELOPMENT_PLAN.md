# 蜂巢共享办公 — Next.js 开发计划书

> 版本：v1.0
> 日期：2026-08-02
> 状态：待确认

---

## 一、项目概述

### 1.1 项目简介

「蜂巢」是一个共享办公空间管理系统。会员注册并订阅套餐后，可预订固定工位、会议室或使用灵活区；通过扫码闸机进出；系统按实际使用情况计费，月底生成账单。

本项目基于 `design/` 目录下已完成的 DDD 领域建模进行开发，是 **DDD 模型到 Next.js 实现的完整落地**。

### 1.2 价值闭环（核心业务）

```
会员付费（Membership）→ 资源预订（Booking）→ 计费引擎（Billing）→ 收入
```

### 1.3 业务场景示例

> 小张预订工位 B-12（明天 9:00-18:00）+ 会议室（14:00-15:00）
> → 扫码过闸机 → 用完会议室自动计费（超时 ¥40）
> → 月底账单：会员费 ¥899 + 会议室超时 ¥40

---

## 二、已确认技术决策

| # | 决策项 | 选择 | 说明 |
|---|--------|------|------|
| 1 | 框架 | **Next.js 16**（App Router） | Next.js 15 将于 2026-10 EOL，16 为 Active LTS |
| 2 | ORM | **Drizzle ORM** | 与 DDD 契合：schema 即代码、TS 原生类型推断 |
| 3 | 数据库 | **SQLite（开发） / PostgreSQL（生产）** | Drizzle 同时支持两者，切换成本低 |
| 4 | 手机端 | **暂不做** | 本期仅 Web；API 设计预留（Route Handlers 天然支持） |
| 5 | 架构形态 | **单体模块化（Modular Monolith）** | 单应用 + 按限界上下文分模块，未来可平滑拆分 |

### 2.1 完整技术栈

| 层 | 选型 | 用途 |
|----|------|------|
| 框架 | Next.js 16（App Router + Server Components） | 前后端一体 |
| 语言 | TypeScript（strict） | 领域层强类型 |
| ORM | Drizzle ORM + drizzle-kit（迁移） | 数据访问、schema 管理 |
| 数据库 | SQLite（dev，better-sqlite3）/ PostgreSQL（prod） | 持久化 |
| 鉴权 | Auth.js（NextAuth v5）+ Drizzle Adapter | 会员身份（Membership 基础） |
| UI | Tailwind CSS + shadcn/ui | 会员端 + 管理端界面 |
| 校验 | Zod | 应用层 Command 校验 |
| 事件 | 进程内 Event Bus + **Outbox 表** | 跨上下文事件流，事务可靠 |
| 测试 | Vitest（领域层单测）+ Playwright（E2E，可选） | 状态机/计费策略等重点覆盖 |
| 定时任务 | node-cron / 数据库轮询（NoShow 释放等） | 领域调度 |

---

## 三、架构设计

### 3.1 总体架构：单体模块化

**核心原则：不微服务。** 6 个限界上下文、13 个聚合、38 个操作的系统采用单个 Next.js 应用，按上下文模块化组织：

- ✅ DDD 边界完整保留：每个上下文独立模块，依赖单向（高层→低层）
- ✅ 单一代码库、单一数据库，开发部署简单
- ✅ 未来可平滑拆分：模块边界已对齐 Bounded Context
- ✅ 共享内核（SK）小范围共享：`Money`、`TimeSlot` 等通用值对象

### 3.2 分层模型（对齐 DDD 三层）

```
┌──────────────────────────────────────────────┐
│  interface 层   Server Actions / Route        │
│                Handlers / Zod 校验 / 表单      │
├──────────────────────────────────────────────┤
│  application 层  应用服务（用例编排、事务、    │
│                  事件发布）                   │
├──────────────────────────────────────────────┤
│  domain 层  实体 / 值对象 / 领域服务 / 策略 /  │
│             状态机 / 聚合（纯 TS，零框架依赖）  │
├──────────────────────────────────────────────┤
│  infrastructure 层  Drizzle Repository 实现、  │
│                     事件订阅、Outbox           │
└──────────────────────────────────────────────┘
```

**⚠️ 关键约束：`domain/` 层必须是纯 TypeScript** —— 不 import next、不 import drizzle，保证状态机/计费策略可独立单测。

### 3.3 六上下文映射关系（源自 CML）

| 上下文 | 类型 | 聚合 | 依赖方向 |
|--------|------|------|---------|
| **Membership** 🪪 | CORE | Member、SubscriptionPlan | → Booking、Billing（OHS/PL）|
| **Booking** 📅 | CORE | DeskBooking、MeetingRoomBooking、FlexSession | → Notification、Access、Billing（OHS/PL）|
| **Billing** 💰 | CORE | Invoice | ← Booking（事件）；↔ Membership（SK）|
| **Access** 🚪 | SUPPORTING | GatePass、AccessLog | → Membership（ACL）|
| **Facility** 🏗️ | GENERIC | Desk、MeetingRoom、Gate、FlexZone | ← Booking（ACL 防腐层）|
| **Notification** 📱 | SUPPORTING | Notification | ← Booking、Billing（事件）|

### 3.4 跨上下文协作：事件驱动

各上下文通过 **领域事件** 解耦（对齐 CML 的 OHS/PL 关系）：

```
BookingCheckedIn ──► Billing 记录计费开始
BookingCheckedOut ──► Billing 结算工位费
RoomBookingCompleted ──► Billing 计算会议室费 + 超时费
FlexSessionEnded ──► Billing 结算灵活区费
BookingConfirmed ──► Access 创建 GatePass + Notification 发通知
MemberUpgraded ──► Billing 重新计算折扣
GateStatusChanged ──► Access 更新通行策略（Facility → Access）
FlexZoneStatusChanged ──► Booking 调整入场策略（Facility → Booking）
```

实现方式：进程内 Event Bus + Outbox 表。每个应用服务在**同一事务**内写业务变更 + Outbox 事件记录，后台消费者发布事件，保证最终一致。

---

## 四、目录结构

```
hive/
├── design/                       # DDD 建模文档（已有，不变）
├── src/
│   ├── modules/                  # 6 个限界上下文模块
│   │   ├── membership/
│   │   │   ├── domain/           # Member, SubscriptionPlan, Money, MemberTier, 领域服务
│   │   │   ├── application/      # MembershipApplicationService（用例编排）
│   │   │   ├── infrastructure/   # Drizzle Repository 实现、事件订阅
│   │   │   └── interface/        # Server Actions / Route Handlers / Zod 校验
│   │   ├── booking/
│   │   │   ├── domain/           # DeskBooking, MeetingRoomBooking, FlexSession,
│   │   │   │                     #   状态机, BookingPolicies, TimeSlot
│   │   │   ├── application/      # BookingApplicationService, FlexSeatingService
│   │   │   ├── infrastructure/
│   │   │   └── interface/
│   │   ├── billing/
│   │   │   ├── domain/           # Invoice, RatePolicy(策略), OvertimePolicy,
│   │   │   │                     #   GracePeriod, ChargeType
│   │   │   ├── application/      # BillingApplicationService（事件订阅 + 出账）
│   │   │   ├── infrastructure/
│   │   │   └── interface/
│   │   ├── access/
│   │   │   ├── domain/           # GatePass, AccessLog
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interface/
│   │   ├── facility/
│   │   │   ├── domain/           # Desk, MeetingRoom, Gate, FlexZone
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interface/
│   │   └── notification/
│   │       ├── domain/           # Notification, NotificationComposer
│   │       ├── application/
│   │       ├── infrastructure/
│   │       └── interface/
│   ├── shared/                   # 共享内核：Money, TimeSlot, 通用事件基类
│   ├── lib/                      # db 客户端、auth、event-bus、outbox、配置
│   └── app/                      # App Router 页面（见第五章）
├── drizzle/                      # drizzle 迁移文件
├── tests/                        # 领域层单测（按上下文组织）
├── seed/                         # 种子数据（套餐、费率、工位、会议室）
└── package.json
```

---

## 五、页面路由规划

### 5.1 会员端 `(member)/`

| 路由 | 功能 | 关联上下文 |
|------|------|-----------|
| `/dashboard` | 工作台：今日预订、通行证、通知 | Booking + Access |
| `/bookings` | 我的预订列表（签到/签退/取消） | Booking |
| `/bookings/desk` | 预订固定工位 | Booking + Facility |
| `/bookings/room` | 预订会议室 | Booking + Facility |
| `/flex` | 灵活区：入场/离场/可用工位 | Booking + Facility |
| `/billing` | 账单明细 + 支付入口 | Billing |
| `/notifications` | 通知中心 | Notification |
| `/profile` | 个人信息、套餐、等级 | Membership |

### 5.2 管理端 `(admin)/`

| 路由 | 功能 | 关联上下文 |
|------|------|-----------|
| `/admin` | 管理端仪表盘 | — |
| `/admin/facility` | 工位/会议室/闸机/灵活区域管理 | Facility |
| `/admin/members` | 会员与套餐管理 | Membership |
| `/admin/billing` | 账单与计费管理 | Billing |
| `/admin/access` | 通行记录查询 | Access |
| `/admin/settings` | 费率/策略配置（RatePolicy 管理） | Billing |

### 5.3 公共区 `(public)/` 与 API

- `(public)/`：落地页、登录/注册
- `api/webhooks/payment`：支付网关回调（预留）
- `api/webhooks/gate`：闸机硬件事件（预留，本期以模拟扫码替代）

---

## 六、核心领域设计要点（实现时须严格保留）

### 6.1 三个预订聚合 = 三种业务模式

| 聚合 | 适用 | 计费 | 工位绑定 |
|------|------|------|---------|
| DeskBooking | FIXED_DESK 固定工位 | 含在套餐内/按天加购 | 必须 DeskId |
| MeetingRoomBooking | 会议室 | 按预订时长 + 超时费 | 无 |
| FlexSession | FLEX_DESK 灵活区 | 按实际在场时长 | 不绑定 |

### 6.2 状态机（领域不变量）

**DeskBooking**：`PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`，可分支 `CANCELLED`（30分钟前）、`NO_SHOW`（15分钟未签到）
**MeetingRoomBooking**：`PENDING → CONFIRMED → IN_PROGRESS → COMPLETED / CANCELLED`
**FlexSession**：`ACTIVE → COMPLETED / NO_SHOW`

### 6.3 计费引擎

- **五种费用类型**：MEMBERSHIP_FEE / DESK_USAGE / FLEX_USAGE / ROOM_USAGE / OVER_TIME_PENALTY
- **RatePolicy 策略模式**：FLEX(¥15/h 超额) < FIXED(¥20/h) < VIRTUAL(¥30/h)，会议室 ¥30/h/¥60/h、全天打包 ¥250、超时 ¥80/h、会员折扣（GOLD 9折 / PLATINUM 8折）
- **OvertimePolicy**：超时费 =（实际结束 − 预订结束 − GracePeriod 15min）× 超时费率
- **封顶规则**：FLEX 月封顶月费 120%、日封顶；防止费用失控
- **月末出账**：`generateMonthlyInvoice()` 聚合当月所有 UsageRecord 生成 Invoice

### 6.4 跨上下文防腐层（ACL）

- Booking 查询 Facility 资源状态时，通过 **Repository 接口** 隔离（不直接依赖 Facility 内部实现）
- Access 校验会员身份走 ACL 查询 Membership

---

## 七、分阶段实施计划

```
Phase 0  基础设施          Scaffold Next.js 16 + Drizzle + Auth.js + shadcn/ui
                         + Outbox 事件总线 + Money/TimeSlot 共享内核
                         + SQLite 连接 + 种子数据框架
Phase 1  地基上下文        Facility（工位/会议室/区域/闸机 CRUD + 可用性查询）
                         + Membership（注册/登录/套餐/等级）
Phase 2  核心·Booking      DeskBooking 状态机 + MeetingRoomBooking
                         + FlexSession + 可用性冲突校验 + 取消/NoShow 规则
Phase 3  核心·Billing      RatePolicy + OvertimePolicy + GracePeriod
                         + 事件驱动计费 + 月度出账 + 支付（模拟）
Phase 4  支撑上下文        Access（GatePass + AccessLog，模拟扫码）
                         + Notification（预订/账单通知，in-app）
Phase 5  管理端 + 打磨     Admin CMS + 报表 + 测试补全 + 部署（PostgreSQL）
```

### 7.1 MVP 裁剪策略

**优先打通「价值闭环」**：Membership → Booking → Billing（core-business.md 定义的收入中枢）。

| 上下文 | MVP 处理 |
|--------|---------|
| Membership | 完整实现（注册/套餐/等级是基础） |
| Booking | 完整实现（核心价值） |
| Billing | 完整实现（核心价值） |
| Access | **模拟扫码**：签到/签退走 Web 操作，不接真实闸机硬件 |
| Facility | 实现工位/会议室/灵活区域管理（闸机设备管理可延后） |
| Notification | 简单 in-app 通知（邮件/短信/SMS 第三方推送延后） |

### 7.2 里程碑验收标准

| 阶段 | 完成标志 |
|------|---------|
| Phase 0 | `next dev` 启动、DB 迁移可用、登录注册可用、领域层空壳可单测 |
| Phase 1 | 管理员可维护工位/会议室；会员可注册并订阅套餐 |
| Phase 2 | 会员可预订工位/会议室、灵活区签到离场；状态机全部流转正确 |
| Phase 3 | 事件驱动计费正确；月末账单金额与 design 文档推演一致（¥939 场景可复现）|
| Phase 4 | 预订确认自动生成通行证 + 通知；扫码通行记录可查 |
| Phase 5 | 管理端完整、PostgreSQL 部署可用 |

---

## 八、测试策略

| 层级 | 工具 | 重点 |
|------|------|------|
| 领域层单测 | Vitest | 状态机流转、OvertimePolicy、GracePeriod、RatePolicy、NoShow 规则 |
| 应用层单测 | Vitest | 用例编排、事件发布、事务 |
| 集成测试 | Vitest + SQLite | Repository、Outbox 消费 |
| E2E（可选） | Playwright | 关键用户旅程：预订→签到→计费→出账 |

**关键验收用例**（对齐 design 文档）：
1. 小张场景：FIXED_DESK 会员预订工位 + 会议室超时 45min → 账单 ¥899 + ¥30 + ¥40 = ¥939
2. 超时 10min（≤ GracePeriod）→ 不收费
3. 签到 15 分钟未到 → NO_SHOW 自动释放
4. FLEX_DESK 免费额度 40h，超额按 ¥15/h，月封顶 120%

---

## 九、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| DDD 落地过度抽象 | 开发慢、代码复杂 | 只保留聚合根/值对象/策略等核心模式，CRUD 直接走 Repository |
| SQLite ↔ PostgreSQL 差异 | 迁移问题 | 用 Drizzle 抽象层，SQL 方言差异集中管理；尽早用 Postgres 冒烟 |
| 事件一致性问题 | 计费数据不准 | Outbox 模式保证最终一致；关键金额在应用层用事务保证 |
| 计费规则复杂（封顶/免罚/折扣） | 计算错误 | 计费规则全部落在纯函数（domain 层），重度单测 |

---

## 十、待办确认项

- [ ] 本计划书整体确认
- [ ] Phase 0 开始：Next.js 16 脚手架初始化
- [ ] 种子数据范围确认（套餐定价、费率、示例工位/会议室）
- [ ] 管理端是否本期全部实现，或先聚焦会员端

---

> 计划书确认后，从 **Phase 0** 开始实施。每阶段完成有明确验收标准，阶段间可随时调整优先级。
