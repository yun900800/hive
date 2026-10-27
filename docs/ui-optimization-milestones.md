# 蜂巢 UI 优化里程碑（P0–P7）

> 创建：2026-10-25
> 基线：会员端与管理端视觉重构已完成（`c4b8901`、`2c5098f`）
> 原则：只改展示层；不动 `domain/`、`application/`、server actions 的业务逻辑
> 用法：完成一项就把 `- [ ]` 改成 `- [x]`，并更新「进度总览」和该里程碑的「完成记录」

## 进度总览

| 里程碑 | 主题 | 任务数 | 已完成 | 状态 |
|---|---|---:|---:|---|
| P0 | 会员端遗留三页视觉统一 | 4 | 4 | ✅ 完成 |
| P1 | 预订页外壳与资源名 | 4 | 4 | ✅ 完成 |
| P2 | 登录/注册与内部链接 | 4 | 4 | ✅ 完成 |
| P3 | 我的预订筛选 | 4 | 4 | ✅ 完成 |
| P4 | 账单明细折叠 + 全局反馈 | 4 | 4 | ✅ 完成 |
| P5 | 管理端会员搜索/筛选 | 4 | 4 | ✅ 完成 |
| P6 | 管理端账单/通行筛选 + 分页 | 4 | 0 | ⬜ 未开始 |
| P7 | 移动端、可访问性与清理 | 5 | 0 | ⬜ 未开始 |
| **合计** |  | **33** | **24** | 🟨 进行中 |

状态图例：⬜ 未开始 / 🟨 进行中 / ✅ 完成

> P0–P7 是执行顺序，不是严重程度。P0 最先做，因为它是目前最明显的视觉断层。

## 已完成（历史基线）

- [x] 设计令牌、AppShell、patterns（PageHeader / StatCard / StatusBadge / SectionCard / EmptyState / PageSkeleton）
- [x] 会员端第一批：dashboard、我的预订、订工位表单、订会议室表单、通行证、订阅、账单（`c4b8901`）
- [x] 管理端 6 页：经营总览、空间资源、会员、套餐、账单、通行、报表（`2c5098f`）
- [x] 404、`error.tsx`、`global-error.tsx`

## P0 — 会员端遗留三页视觉统一 ✅

**目标**：把 `/flex`、`/notifications`、`/profile` 拉齐到现有设计系统，消除旧 Card、原始英文枚举和原生控件。

**任务**

- [x] `/flex`：改用 PageHeader + SectionCard；`FLEX_DESK` 等用 `labelOf("planType", ...)`；原生 `<select>` 换成 base-ui Select；无权限时用统一的提示卡/EmptyState
- [x] `/notifications`：改用 PageHeader + 列表卡；未读状态用品牌色点或统一 Badge；保留「全部已读」；补空状态
- [x] `/profile`：改用 PageHeader + SectionCard；`tier` / `planType` / `status` 中文化并用 StatusBadge；`<a>` 换成 `Link`
- [x] 三页做 1440px 与 390px 截图检查

**涉及文件**

- `src/app/(member)/flex/page.tsx`
- `src/app/(member)/flex/flex-checkin-form.tsx`
- `src/app/(member)/flex/flex-checkout-form.tsx`
- `src/app/(member)/notifications/page.tsx`
- `src/app/(member)/notifications/notification-actions.tsx`
- `src/app/(member)/profile/page.tsx`

**验收**

- 页面不再出现 `FLEX_DESK`、`ACTIVE`、`GOLD` 等原始枚举
- 不再使用旧 `Card` 作为页面主容器
- 移动端无横向溢出
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：2026-10-25
- Commit：999bf9c

## P1 — 预订页外壳与资源名 ✅

**目标**：解决「新表单被旧 Card 包着」的双层卡片，以及会员看不懂 UUID 资源名的问题。

**任务**

- [x] 订工位页：PageHeader + SectionCard 或两栏布局，移除旧 Card 包裹
- [x] 订会议室页：同上
- [x] 我的预订：用 `listDesks()` / `listMeetingRooms()` / `listFlexZones()` 做 id → `desk.code` / `room.name` / `zone.name` 映射，不再显示 UUID 前 8 位
- [x] 我的预订列表改用 SectionCard，与全站容器一致

**涉及文件**

- `src/app/(member)/bookings/desk/page.tsx`
- `src/app/(member)/bookings/room/page.tsx`
- `src/app/(member)/bookings/page.tsx`

**验收**

- 预订页不再出现「卡片套卡片」
- 我的预订显示 `B-12`、`华山厅`、`A 区` 等可读名称
- 操作按钮逻辑不变
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：2026-10-26
- Commit：e2caf75
- 额外：修复 `/bookings/*` 子路由导致「我的预订」和当前子项同时高亮的导航匹配问题

## P2 — 登录/注册与内部链接 ✅

**目标**：补齐公共入口的第一印象，并清掉最后几个 `<a>` 全页刷新。

**任务**

- [x] 登录页：品牌分栏/蜂巢氛围、演示账号、返回首页入口
- [x] 注册页：与登录页同一套视觉语言
- [x] 登录/注册的 `<a>` 全部换成 `Link`
- [x] 表单错误/加载态统一：`aria-live`、`disabled`、按钮文案

**涉及文件**

- `src/app/(public)/login/page.tsx`
- `src/app/(public)/login/login-form.tsx`
- `src/app/(public)/register/page.tsx`
- `src/app/(public)/register/register-form.tsx`

**验收**

- 登录/注册在 1440px 与 390px 下都不显得空旷
- 页内跳转不再触发整页刷新
- 错误信息可被读屏读取
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：2026-10-26
- Commit：0e980d4
- 额外：登录/注册移入 `(auth)` 路由组，去掉公共页头页脚；注册成功后自动跳转登录页

## P3 — 我的预订筛选 ✅

**目标**：让会员能按类型、状态、时间快速找到预订。

**任务**

- [x] 解析 URL `searchParams`：`type` / `status` / `from` / `to`
- [x] 筛选 UI：类型/状态 chips + 时间范围 + 重置
- [x] 空结果状态 + 结果计数
- [x] 筛选在服务端完成，保持现有操作按钮逻辑不变

**涉及文件**

- `src/app/(member)/bookings/page.tsx`
- 新增筛选客户端组件（放在 `bookings/` 下）

**注意**

- Next.js 16 的 `searchParams` 是 Promise；实现前先读 `node_modules/next/dist/docs/` 对应章节
- 不新增依赖

**验收**

- 筛选条件可分享、刷新后保留
- 无结果时显示 EmptyState，而不是空表格
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：2026-10-26
- Commit：ea03e42
- 额外：用状态分组统一工位/会议室/灵活区的不同状态值；筛选栏用 `Link` + GET 表单，无需客户端 JS

## P4 — 账单明细折叠 + 全局反馈 ✅

**目标**：缩短账单页长度，并让操作成功/失败有统一反馈。

**任务**

- [x] 会员账单：每张账单明细默认收起，点开查看
- [x] 管理端账单：明细/操作可折叠（可选但建议）
- [x] Toast 基建：确认 `Toaster` 已挂载，统一 success/error 调用方式
- [x] 接入 toast：预订、支付、角色切换、删除、灵活区签到/签退

**涉及文件**

- `src/app/(member)/billing/page.tsx`
- `src/app/admin/billing/page.tsx`
- `src/app/(member)/bookings/booking-actions.tsx`
- `src/app/admin/members/member-role-button.tsx`
- `src/app/admin/facility/delete-button.tsx`
- `src/app/(member)/flex/flex-checkin-form.tsx`
- `src/app/(member)/flex/flex-checkout-form.tsx`

**注意**

- `Toaster` 已在 `src/app/layout.tsx` 挂载，但目前全站没有 `toast()` 调用
- 只改客户端反馈，不动 server actions

**验收**

- 账单列表首屏明显变短
- 成功/失败都有 toast，且不重复堆叠
- 行内错误仍保留给读屏/无 JS 场景
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：2026-10-26
- Commit：01374db
- 额外：账单明细用原生 `<details>` 默认收起；`useActionWithToast` 统一包装 action，固定 toast id 去重；成功反馈走 toast，行内只保留错误

## P5 — 管理端会员搜索/筛选 ✅

**目标**：会员数量增长后，运营仍能快速定位人。

**任务**

- [x] 姓名/邮箱搜索
- [x] 等级/角色/订阅状态筛选
- [x] 结果计数 + 重置 + 空状态
- [x] 当前 28 行先用客户端过滤；数据明显增长后再迁 URL query

**涉及文件**

- `src/app/admin/members/page.tsx`
- 新增筛选客户端组件（放在 `admin/members/` 下）

**验收**

- 搜索/筛选即时生效，不需要刷新
- 清空条件后恢复全量
- 移动端筛选控件不溢出
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：2026-10-27
- Commit：d7b1503
- 额外：新增 `MemberDirectory` 客户端组件，支持姓名/邮箱关键词模糊搜索、等级、角色及订阅状态多维即时过滤、重置按钮和空结果恢复状态

## P6 — 管理端账单/通行筛选 + 分页

**目标**：让账单和通行记录从「全量长表」变成可检索、可翻页的运营工具。

**任务**

- [ ] 账单筛选：月份/状态/会员
- [ ] 账单分页或「加载更多」
- [ ] 通行筛选：结果/方向/日期/闸机
- [ ] 通行分页或「加载更多」，并写清统计卡是「全量」还是「当前筛选结果」

**涉及文件**

- `src/app/admin/billing/page.tsx`
- `src/app/admin/access/page.tsx`

**注意**

- 通行当前固定取最近 200 条；分页时先明确是页面切片还是应用层分页
- 账单排序建议按出账时间倒序，保持现状

**验收**

- 筛选条件可分享、刷新后保留
- 长列表不再无限下拉
- 统计卡口径与筛选关系在页面上有说明
- `npx tsc --noEmit`、`npx eslint` 通过

**完成记录**

- 日期：—
- Commit：—

## P7 — 移动端、可访问性与清理

**目标**：最后一轮打磨，保证移动端可用、键盘可用、仓库干净。

**任务**

- [ ] 移动端表格卡片化：我的预订、管理端会员、管理端账单
- [ ] 长列表表格 sticky 表头
- [ ] 可访问性 audit：`focus-visible`、`aria-live`、对比度、键盘操作
- [ ] 管理员/会员端切换入口（管理员有 `memberId` 时显示）
- [ ] 清理 `ui-*.png`、历史 ESLint 错误，并补一次 `npm run build` 验证

**涉及文件**

- 会员端与管理端相关表格页
- `src/components/shell/user-menu.tsx` / `nav-config.ts`
- 仓库根目录截图

**注意**

- 跑 `npm run build` 前先停 dev server，避免 `.next` 目录锁冲突
- 历史 ESLint 错误包括 `.opencode` 脚本、`src/shared/outbox.ts`、`billing-app.ts`，与 UI 无关，单独处理

**验收**

- 390px 下主要列表不需要横向滚动
- 键盘可以完成主要操作
- `npm run build` 通过
- 截图与历史 lint 错误已清理

**完成记录**

- 日期：—
- Commit：—

## 全局完成标准（每个里程碑都适用）

- `npx tsc --noEmit` 通过
- `npx eslint` 针对改动文件通过
- 1440px 桌面 + 390px 移动端截图检查
- 页面不出现原始枚举或 UUID 片段
- 不改 `domain/`、`application/`、server actions 的业务逻辑
- 更新本文件的复选框、进度总览、完成记录

## 暂不纳入

- 套餐 CRUD、空间资源编辑等新功能（属于功能开发，不是 UI 优化）
- 引入图表库（现有 CSS/SVG 条形图够用）
- 大改导航结构或权限模型
- 重写 server actions / 领域模型

## 推荐执行顺序

1. P0 → P1 → P2（视觉断层与公共入口）
2. P3 → P4（会员端体验与反馈）
3. P5 → P6（管理端效率）
4. P7（移动端与收尾）

每完成一个里程碑，建议单独提交一次，提交信息示例：

- `feat(ui): unify member flex/notifications/profile pages`
- `feat(bookings): show resource names and polish booking shells`
- `feat(auth): redesign login and register pages`
- `feat(bookings): add type/status/time filters`
- `feat(billing): collapse line items and add toast feedback`
- `feat(admin): add member search and filters`
- `feat(admin): add billing/access filters and pagination`
- `chore(ui): mobile tables, a11y audit and cleanup`
