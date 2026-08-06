# 部署总结 (Deployment Summary)

> 记录 Hive 项目的 GitHub 上传与 Vercel 部署信息。更新日期：2026-08-06

## 项目概览

- **项目名**：hive-web — 蜜蜂协作办公（Coworking 空间管理平台）
- **技术栈**：Next.js 16.2.12 · React 19 · Drizzle ORM · SQLite(libsql) · NextAuth v5 · Tailwind 4

---

## 1. GitHub 仓库

| 项目 | 值 |
|------|-----|
| 地址 | https://github.com/yun900800/hive |
| 可见性 | **公开 (public)** |
| 默认分支 | `master` |
| 初始提交 | `b807f47` — "Initial commit: Hive coworking management platform" |
| 文件数 | 178 |

**已排除（通过 .gitignore）**：
- `data/` — 本地 SQLite 数据库（含真实数据）
- `.tmp/` — 临时/会话文件
- `.opencode/` — AI 代理工作区（54MB）
- `.env*` — 所有环境变量文件（含 API 密钥）

---

## 2. Vercel 部署

| 项目 | 值 |
|------|-----|
| 生产环境 URL | **https://hive-wheat-ten.vercel.app** |
| 部署面板 | https://vercel.com/yun900800s-projects-70c7b623/hive |
| 账号 | `hekaihk16-3669` |
| 构建耗时 | ~47s（2 核 / 8GB，iad1 区域） |
| 页面 | 24 个路由全部编译成功（20 动态 + 4 静态） |
| 验证结果 | 首页 & 登录页 HTTP 200 ✅，种子数据正常渲染 ✅ |

**自动部署**：已连接 GitHub 仓库，推送 `master` 分支自动触发生产部署。

---

## 3. Turso 数据库

| 项目 | 值 |
|------|-----|
| **生产数据库（当前使用）** | `hive-db` — libsql://hive-db-yun900800.aws-eu-west-1.turso.io（独立数据库） |
| 旧数据库（保留） | `commerce-db` — 原电商项目数据（categories/orders/products 等），未被改动 |
| 初始化方式 | `drizzle-kit migrate`（应用 0000–0003 迁移） |
| 结果 | hive-db：21 张 hive 表 + 种子数据 ✅ |

**⚠️ 重要决策**：未使用 `drizzle-kit push`，因为它可能删除 schema 中不存在的旧表。迁移只执行 `CREATE TABLE`，对存量数据安全。

**方案 B（2026-08-06）**：将生产数据库从 `commerce-db`（混有旧电商表）迁移到独立的 `hive-db`。通过 Turso REST API（`/v1/organizations/yun900800/databases`）创建数据库并生成 10 年有效期 full-access token。

### 种子数据

| 数据 | 数量 |
|------|------|
| 套餐 | 4（灵活办公位 ¥499 / 固定办公位 ¥899 / 独立办公室 ¥3999 / 虚拟会员 ¥199） |
| 工位 | 5 |
| 会议室 | 3 |
| 灵活区域 | 2 |
| 闸机 | 3 |
| 管理员 | `admin@hive.com` / `admin123` |

> 种子脚本幂等：`plans` 表非空则跳过；如需重置设 `DATABASE_SEED_FORCE=1`。

---

## 4. 环境变量（Vercel Production）

| 变量 | 值 | 说明 |
|------|-----|------|
| `DATABASE_URL` | `libsql://hive-db-yun900800.aws-eu-west-1.turso.io?authToken=<token>` | Turso 连接串（指向 hive-db，token 内嵌于 URL） |
| `AUTH_SECRET` | 随机 32 字节 base64 | NextAuth 签名密钥（生成一次即可） |

> 类型为 **Sensitive**（隐藏显示）。Preview 环境变量未配置（CLI 交互限制），可在 Vercel 控制台 → Settings → Environment Variables 补充。

---

## 5. 常用命令

```bash
# 本地开发
npm run dev

# 生产构建
npm run build

# 数据库操作（需设置 DATABASE_URL）
npm run db:push      # 同步 schema（注意：会删 schema 外旧表）
npm run db:migrate   # 应用迁移文件（安全，推荐）
npm run db:seed      # 填充种子数据

# 部署
vercel --prod        # 手动部署生产
```

---

## 6. 后续建议

- [ ] 修改管理员默认密码（`admin123`）
- [ ] 在 Vercel 控制台补充 Preview 环境变量（如需要预览部署）
- [ ] 为 `master` 配置 Branch Protection（当前仓库公开）
- [ ] 定期轮换 Turso Auth Token 与 `AUTH_SECRET`
