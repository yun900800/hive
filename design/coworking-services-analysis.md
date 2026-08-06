# 蜂巢共享办公 — 各限界上下文 Service 补全方案

## 场景回顾

> 小张是「蜂巢」的会员。他在 App 上预订了明天 9:00-18:00 的靠窗工位 B-12，顺便约了一间 4 人会议室下午 2 点到 3 点。
> 到前台扫会员码，闸机放行。用完会议室后系统自动结束计费。
> 月底收到账单：会员费 ¥899 + 会议室超时 ¥40。

## 各 Context Service 总览

### 1. MembershipContext 🪪

| 层级 | Service | 操作 |
|------|---------|------|
| Domain | `MembershipService` | • `verifyIdentity()` — 扫码验身份<br>• `getMemberTier()` — 查询等级（影响折扣）<br>• `getCurrentPlan()` — 查询套餐（决定准入） |
| Application | `MembershipApplicationService` | • `registerMember()` — 注册会员<br>• `subscribePlan()` — 订阅/变更套餐<br>• `cancelSubscription()` — 取消订阅 |

### 2. BookingContext 📅

| 层级 | Service | 操作 |
|------|---------|------|
| Application | `BookingApplicationService` | • `createDeskBooking()` — 创建工位预订 → 发事件<br>• `completeRoomBooking()` — 完成会议室 → 通知计费<br>• `checkIn()` / `checkOut()` — 签到/签退<br>• `findBookingsByMemberAndDate()` — 查当日预订 |
| Application | `FlexSeatingService` | • `checkIn()` / `checkOut()` — 灵活区入场/离场<br>• `findAvailableDesks()` — 查可用工位 |
| Domain | `BookingPolicies` | • `canCancel()` — 30分钟前免费取消规则<br>• `isNoShow()` — NoShow判定（15分钟未到） |

### 3. AccessContext 🚪

| 层级 | Service | 操作 |
|------|---------|------|
| Domain | `GateAccessService` | • `scanToEnter()` — 扫码开门（验身份→查预订→开闸→记日志→发事件）<br>• `scanToExit()` — 离场扫码 |
| Application | `AccessApplicationService` | • `createGatePass()` — Booking确认后创建通行证<br>• `revokeGatePass()` — 取消预订时撤销通行证<br>• `queryAccessLogs()` — 查询通行记录 |

### 4. BillingContext 💰

| 层级 | Service | 操作 |
|------|---------|------|
| Domain | `BillingService` | • `generateMonthlyInvoice()` — 月账单生成<br>• `calculateUsageFee()` — 按费率算费 |
| Domain | `OvertimePolicy` | • `calculateRoomOvertime()` — 计算超时费（含15分钟免罚策略） |
| Application | `BillingApplicationService` | • `recordDeskUsage()` — 记录工位使用费<br>• `recordRoomUsage()` — 记录会议室费<br>• `recordFlexUsage()` — 记录灵活区费<br>• `processPayment()` — 处理支付 |

### 5. FacilityContext 🏗️

| 层级 | Service | 操作 |
|------|---------|------|
| Domain | `ResourceAvailabilityService` | • `isDeskAvailable()` — 工位是否可预订<br>• `findAvailableDesks()` — 查可用工位列表<br>• `isRoomAvailable()` — 会议室是否可预订 |
| Application | `FacilityManagementService` | • `addDesk()` / `updateDeskStatus()` — 工位管理<br>• `updateRoomStatus()` — 会议室管理<br>• `updateGateStatus()` — 闸机管理<br>• `updateFlexZoneStatus()` — 灵活区域管理 |

### 6. NotificationContext 📱

| 层级 | Service | 操作 |
|------|---------|------|
| Domain | `NotificationComposer` | • `composeBookingConfirmation()` — 组装预订通知<br>• `composeInvoiceNotice()` — 组装账单通知 |
| Application | `NotificationApplicationService` | • `send()` — 发送通知（按渠道偏好）<br>• `retryFailed()` — 重试失败通知<br>• `markAsRead()` — 标记已读 |

---

## DDD Service 三层模型

```
┌──────────────────────────────────────────────┐
│  Application Service (应用服务)               │
│  • 用例编排，跨聚合协调                        │
│  • 管理事务、权限、事件发布                    │
│  • 你说的"像CRUD"的那层就是这里！              │
├──────────────────────────────────────────────┤
│  Domain Service (领域服务)                    │
│  • 跨聚合/跨值对象的业务逻辑                   │
│  • 无状态，不归属单一 Entity                   │
│  • 如 calculateOvertime、verifyIdentity       │
├──────────────────────────────────────────────┤
│  Repository (仓储) — 真正的 CRUD              │
│  • save() / find() 接口                       │
│  • 定义在 Domain 层，实现放 Infra 层           │
└──────────────────────────────────────────────┘
```
