# 工作存档 — 2026-08-20

> 记录 2026-08-20 的工作进展与当前状态，供下次会话加载继续。更新日期：2026-08-20

## 项目概览

- **项目名**：hive-web — 蜜蜂协作办公（Coworking 空间管理平台）
- **技术栈**：Next.js 16.2.12 · React 19 · Drizzle ORM · SQLite(libsql/Turso) · NextAuth v5 · Tailwind 4
- **仓库**：https://github.com/yun900800/hive（master 分支）
- **生产环境**：https://hive.lifebook.ggff.net（Vercel，账号 hekaihk16-3669）
- **生产数据库**：Turso `hive-db-yun900800.aws-eu-west-1.turso.io`

---

## 今日完成的工作

### 1. Bug 修复：消费明细不显示
- **根因**：`ensureMonthlyInvoiceIfNeeded`（`src/modules/billing/application/billing-app.ts`）当月已有账单时 `if (existing) return` 直接返回，不追加新消费明细
- **修复**：移除 early return，始终调用幂等的 `generateMonthlyInvoice`（它内部处理：已有账单→追加未入账明细；无账单→生成新账单；无新费用→静默）

### 2. 新功能：消费明细时间戳
- `invoice_line_item` 表新增 `occurredAt` 列（迁移 0006：`ALTER TABLE invoice_line_item ADD occurredAt integer`）
- 全链路传递：`usage_record.occurredAt` → `invoice_line_item.occurredAt` → 账单页 UI「时间」列
- 涉及文件：
  - `src/modules/billing/infrastructure/db/schema.ts`（+occurredAt 列）
  - `src/modules/billing/domain/types.ts`（InvoiceLineItem +occurredAt?: Date | null）
  - `src/modules/billing/application/billing-app.ts`（7 处 line item 创建/映射路径传递 occurredAt，含 listMyInvoices、合成会员费）
  - `src/app/(member)/billing/page.tsx`（消费明细表新增「时间」列）
  - `drizzle/0006_add_invoice_line_occurred_at.sql` + `drizzle/meta/_journal.json`

### 3. 数据清理（本地库）
- 清除 `yun900900@126.com`（memberId `f8869add-b30f-4c97-a672-52dbf0496c31`）的：7 条 room_booking、2 条 desk_booking、17 条 notification、2 张 invoice、3 条 invoice_line_item、2 条 usage_record、3 条 access_log、9 条 gate_pass、26 条 outbox_event
- **保留**：subscription（1 条 FIXED_DESK）

### 4. Bug 修复：会议室预订后跳转
- `src/app/(member)/bookings/room/room-booking-form.tsx`：新增 `useRouter` + `useRef`（submittedRef）+ `useEffect`，预订成功（无 error）后 `router.push("/bookings")`

### 5. 部署到 Vercel
- 生产库应用迁移 0005（meeting_room.type）+ 0006（invoice_line_item.occurredAt），本地与生产表结构完全一致
- Vercel 环境变量：`DATABASE_URL` = `libsql://hive-db-yun900800.aws-eu-west-1.turso.io`（纯 URL，Sensitive）、`TURSO_AUTH_TOKEN` = 用户提供的 token（Sensitive）、`AUTH_SECRET`、`CRON_SECRET` 已存在
- 部署成功：**https://hive.lifebook.ggff.net**（Next.js 16.2.12，25 页面，48s）
- 生产验证：首页/登录页 200 ✅，API 端点 403（CRON_SECRET 保护生效）✅

### 6. 提交到 GitHub
- **Commit**: `c548936` — `feat(billing): add occurredAt timestamp to invoice line items + fix lazy invoicing + room booking redirect`
- 22 文件，+2518/-22 行，已推送 `master` → `origin/master`
- Vercel 已连接 GitHub，推送自动触发生产部署

---

## 当前状态

### 已验证
- 本地：TypeScript 通过，21 测试文件 / 156 测试全部通过
- 生产库：表结构与本地一致；3 个会议室 type=MEETING_ROOM；2 条历史 invoice_line_item 的 occurredAt 为 NULL（符合预期，新数据自动填充）
- 生产环境：页面可访问，API 安全保护生效

### 生产库数据现状
- 2 个会员：系统管理员（admin@hive.com，无订阅）、云顶公寓（yun900100@126.com，FIXED_DESK ACTIVE）
- 1 条订阅、2 张账单、1 条 usage_record、3 条通知

---

## 后续待办（下次继续）

- [ ] 生产库 `meeting_room.type` 目前全是 `MEETING_ROOM`，如需独立办公室（PRIVATE_OFFICE）需手动更新
- [ ] 生产库历史 `invoice_line_item.occurredAt` 为 NULL，如需回填需写脚本
- [ ] 用户提到"后续问题一个一个来"——等待用户提出新问题
- [ ] 未完成事项：无已知阻塞项

---

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `src/modules/billing/application/billing-app.ts` | 计费核心（generateMonthlyInvoice / ensureMonthlyInvoiceIfNeeded / recordRoomUsage / recordRoomOvertime / listMyInvoices） |
| `src/modules/billing/application/billing-subscribers.ts` | 事件订阅（room-booking-started→recordRoomUsage 等） |
| `src/modules/billing/infrastructure/db/schema.ts` | 计费表结构（usage_record / invoice / invoice_line_item） |
| `src/modules/billing/domain/types.ts` | 计费领域类型（InvoiceLineItem / Invoice / UsageRecord） |
| `src/modules/booking/application/booking-app.ts` | 预订应用服务（createRoomBooking / startRoomBooking / completeRoomBooking） |
| `src/modules/booking/interface/actions/booking.ts` | 预订 server actions（含 bootstrap 导入） |
| `src/app/(member)/billing/page.tsx` | 账单页（消费明细 + 时间列） |
| `src/app/(member)/bookings/room/room-booking-form.tsx` | 会议室预订表单（成功跳转） |
| `src/shared/outbox.ts` | Outbox 分发器（dispatchOutboxEvents，catch 静默吞错） |
| `src/shared/events.ts` | 事件注册表（模块级 Map） |
| `src/lib/db/index.ts` | DB 客户端（DATABASE_URL + TURSO_AUTH_TOKEN） |
| `drizzle/` | 迁移文件（0000-0006） |
| `deploy-summary.md` | 部署总结（2026-08-06，含旧 URL 信息） |

---

## 环境信息

- **本地数据库**：`./data/hive.db`（.gitignore 排除）
- **管理员账号**：admin@hive.com / admin123
- **Vercel 项目**：yun900800s-projects-70c7b623/hive
- **Turso 数据库**：hive-db-yun900800.aws-eu-west-1.turso.io（token 在 Vercel 环境变量 TURSO_AUTH_TOKEN）