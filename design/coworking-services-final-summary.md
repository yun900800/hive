# 蜂巢共享办公 — CML Service 补全最终总结

## 已完成文件

| 文件 | 路径 |
|------|------|
| 方案分析 | `example/coworking-services-analysis.md` |
| CML 更新（含全部 Service） | `example/coworking-hive.cml` |

---

## 各 Context Service 清单

### MembershipContext 🪪

| Service | 层级 | 操作 | 说明 |
|---------|------|------|------|
| **MembershipService** | Domain | `verifyIdentity()` — 扫码验身份 | 跨聚合：会员身份验证 |
| | | `getMemberTier()` — 查询等级 | 影响折扣/权益 |
| | | `getCurrentPlan()` — 查询套餐 | 决定准入门禁区域 |
| **MembershipApplicationService** | Application | `registerMember()` — 注册会员 | 创建会员账号 |
| | | `subscribePlan()` — 订阅套餐 | 变更套餐 → 触发 Billing |
| | | `cancelSubscription()` — 取消订阅 | 取消套餐 |

### BookingContext 📅

| Service | 层级 | 操作 | 说明 |
|---------|------|------|------|
| **BookingApplicationService** | Application | `createDeskBooking()` — 创建工位预订 | 核心用例编排 |
| | | `completeRoomBooking()` — 完成会议室 | 通知 Billing 计费 |
| | | `checkIn()` / `checkOut()` — 签到/签退 | 状态流转 |
| | | `findBookingsByMemberAndDate()` — 查当日预订 | Access 扫码时用 |
| **FlexSeatingService** | Application | `checkIn()` / `checkOut()` — 灵活区入场/离场 | FLEX_DESK 专用 |
| | | `findAvailableDesks()` — 查可用工位 | 灵活区选座 |
| **BookingPolicies** | Domain | `canCancel()` — 30分钟前免费取消 | 取消策略规则 |
| | | `isNoShow()` — NoShow 判定 | 15分钟未到释放 |

### AccessContext 🚪

| Service | 层级 | 操作 | 说明 |
|---------|------|------|------|
| **GateAccessService** | Domain | `scanToEnter()` — 扫码开门 | 验身份→查预订→开闸→记日志→发事件 |
| | | `scanToExit()` — 离场扫码 | 出口通行 |
| **AccessApplicationService** | Application | `createGatePass()` — 创建通行证 | Booking 确认后触发 |
| | | `revokeGatePass()` — 撤销通行证 | 取消预订时触发 |
| | | `queryAccessLogs()` — 查询通行记录 | 安全审计用 |

### BillingContext 💰

| Service | 层级 | 操作 | 说明 |
|---------|------|------|------|
| **BillingService** | Domain | `generateMonthlyInvoice()` — 月账单生成 | 聚合使用记录出账 |
| | | `calculateUsageFee()` — 按费率算费 | 费率策略计算 |
| **OvertimePolicy** | Domain | `calculateRoomOvertime()` — 计算超时费 | 含 15 分钟免罚策略 |
| **BillingApplicationService** | Application | `recordDeskUsage()` — 记录工位费 | 监听 Booking 事件 |
| | | `recordRoomUsage()` — 记录会议室费 | 监听 RoomBookingCompleted |
| | | `recordFlexUsage()` — 记录灵活区费 | 监听 FlexSessionEnded |
| | | `processPayment()` — 处理支付 | 支付流水 |

### FacilityContext 🏗️

| Service | 层级 | 操作 | 说明 |
|---------|------|------|------|
| **ResourceAvailabilityService** | Domain | `isDeskAvailable()` — 工位是否可预订 | 无冲突/非维护中 |
| | | `findAvailableDesks()` — 查可用工位列表 | 按楼层/类型筛选 |
| | | `isRoomAvailable()` — 会议室是否可预订 | 时段冲突检查 |
| **FacilityManagementService** | Application | `addDesk()` / `updateDeskStatus()` — 工位管理 | 工位 CRUD |
| | | `updateRoomStatus()` — 会议室管理 | 状态变更 |
| | | `updateGateStatus()` — 闸机管理 | 状态变更 → 通知 Access |
| | | `updateFlexZoneStatus()` — 灵活区域管理 | 状态变更 → 通知 Booking |

### NotificationContext 📱

| Service | 层级 | 操作 | 说明 |
|---------|------|------|------|
| **NotificationComposer** | Domain | `composeBookingConfirmation()` — 组装预订通知 | 通知模板组装 |
| | | `composeInvoiceNotice()` — 组装账单通知 | 账单通知模板 |
| **NotificationApplicationService** | Application | `send()` — 发送通知 | 按渠道偏好推送 |
| | | `retryFailed()` — 重试失败通知 | 失败重试 |
| | | `markAsRead()` — 标记已读 | 已读状态更新 |

---

## 统计总览

| Context | Domain Service 数 | Application Service 数 | Service 总数 | 操作总数 |
|---------|:-:|:-:|:-:|:-:|
| Membership 🪪 | 1 | 1 | **2** | **6** |
| Booking 📅 | 1 | 2 | **3** | **7** |
| Access 🚪 | 1 | 1 | **2** | **5** |
| Billing 💰 | 2 | 1 | **3** | **7** |
| Facility 🏗️ | 1 | 1 | **2** | **8** |
| Notification 📱 | 1 | 1 | **2** | **5** |
| **合计** | **7** | **7** | **14** | **38** |

---

## DDD Service 分层说明

```ascii
┌──────────────────────────────────────────────┐
│  Application Service (应用服务) — 7 个        │
│  • 用例编排，跨聚合协调                        │
│  • 管理事务、权限、事件发布                    │
│  • "像 CRUD" 的那层，但背后有完整业务流        │
├──────────────────────────────────────────────┤
│  Domain Service (领域服务) — 7 个             │
│  • 跨聚合/跨值对象的业务逻辑                   │
│  • 无状态，不归属单一 Entity                   │
│  • 如 calculateOvertime、verifyIdentity       │
├──────────────────────────────────────────────┤
│  Repository (仓储) — 真正的 CRUD              │
│  • save() / find() 接口                       │
│  • 定义在 Domain 层，实现放 Infra 层           │
└──────────────────────────────────────────────┘
```
