# n8n 发票自动化工作流 — 设计稿

> 版本：v1.0
> 日期：2026-11-15
> 状态：待确认
> 现有资产：`docs/n8n/Automated Invoice Generation & Delivery.json`（n8n 官方模板，本设计在其骨架上改造）
> 对照项目：`hive`（本仓库，作为客户 A）

---

## 一、意图

这不是给某一个客户做的一次性自动化，而是一份**可复用的商品**：在 Fiverr 上售卖「发票自动生成 + 邮件投递 + Google Sheet 留痕」这条闭环，买家各不相同，但底层只维护一份母版。

买家的真实诉求（来源：与需求方沟通）：

1. 客户的收件箱里收到一张**像样的 PDF 发票**；
2. 自己的 **Google Sheet 里能看到**「发了什么、发给谁、什么时候、成功还是失败」；
3. Sheet 不是装饰，它是对账和应付审计的凭据 —— 所以它必须能和实际发出的东西对上。

因此本设计的核心不是"把发票发出去"，而是**让同一套流程在数据形态差异极大的买家之间复用，且每一张发票都可追溯、可重放、可对账**。

现有模板（官方 "Automated Invoice Generation & Delivery"）在演示能跑通，但有四类问题，构成本设计的出发点：

| 类别 | 具体问题 |
|---|---|
| 渲染质量 | PDF 明细区是一段编号文字而非表格；引擎无 CSS 控制；中文缺字体 |
| 契约刚性 | 只认一种入参形状，换买家就要改节点 |
| 可靠性 | 失败分支无响应节点（调用方挂到超时）；重试只靠 `retryOnFail`；无幂等键 |
| 可移植性 | 依赖社区节点 PdfBro，n8n Cloud 用户无法安装 |

---

## 二、目标 / 非目标 / 反目标

### 2.1 目标

- G1 一份母版可交付给 N 个买家，**新客户接入 ≤ 1 人天**，且不改工作流主干
- G2 输出专业级 A4 发票 PDF：中英文均正确、明细为真表格、跨页表头重复
- G3 入参契约稳定，来源系统的字段差异由**配置**消化，不由代码消化
- G4 每张发票有唯一幂等键，重复请求不重复发送
- G5 每次投递结果写回 Google Sheet，含失败原因与重试次数
- G6 交付物可在 **n8n Cloud 与自建实例**上同样运行（只用内置节点 + HTTP Request）

### 2.2 非目标

- N1 不做多租户 SaaS，不托管买家的凭据与其客户数据
- N2 不实现支付。`paid` 只是展示字段
- N3 不实现税务合规（中国增值税专用发票格式、税局接口、欧盟 VAT 申报）；税只做金额展示
- N4 不替买家清理其来源数据质量，只做校验与拒绝
- N5 不做 PDF 数字签名与防篡改

### 2.3 反目标（技术上跑通但算失败）

- A1 每个新买家都要复制粘贴改 Code 节点里的字段名
- A2 发票发出去了，但 Sheet 里查不到或行列对不上
- A3 客户改了 Logo 就要动工作流
- A4 依赖某个社区节点，导致 Cloud 用户无法使用
- A5 一次网络抖动就重复给客户发同一张发票

---

## 三、已定决策

以下是我做出的判断，需需求方复核。标 **[builder call]** 的可由实现者自行决定。

| # | 决策 | 理由 |
|---|---|---|
| D1 | **物理上一客户一份，逻辑上一份**：母版 + 被调用的子流程；交付时只改 `client.config` | 凭据/环境天然隔离；买家可能自建实例，服务端无法多路复用；买断制与多租户的商业模式对不上 |
| D2 | **渲染走 HTTP Request + HTML 模板 + Chromium 渲染 API** | n8n 无内置 HTML→PDF；社区节点在 Cloud 不可用；官方模板库 382 个文档类工作流全部使用内置 HTTP Request；Chromium 才有真 CSS 与中文字体 |
| D3 | PdfBro 降级为**零成本兜底**，不作主路线 | 引擎为 pdfmake，无 CSS 控制、默认无中文字形 |
| D4 | 契约金额统一用**元（小数，2 位）**，不用分 | 各来源单位不同（分/元/最小货币单位），转换职责收敛到映射层，契约保持人类可读 |
| D5 | Google Sheet 在**标准版**是账本；在 **Hive 版**只是镜像 | 标准版买家没有别的存储；Hive 已有 Turso，Sheet 纯审计 |
| D6 | 幂等键 = `invoice.id`，落库/落表唯一 | 与现有 Hive 的 `usage_record_ref_idx` 思路一致 |
| D7 | **模板只做扁平注入，不写循环**：明细行由 Code 节点拼成 `rows_html`，模板用 `{{{ rows_html }}}` 注入 | 避免锁死某个渲染引擎的模板语法，换服务商不用改模板 |
| D8 | 失败时**必须显式响应**，不允许挂起 | 现有模板的 `Mark Invoice Failed` 无出边，是明确 bug |
| D9 | 投递结果写回采用「先占位再更新」：处理前写 `PENDING`，结束后改终态 | 中途崩溃时 Sheet 里留得下痕迹，可被对账发现 |
| D10 | 模板按 `client` + `locale` 选择，文件名即模板 id | 改样式=改文件，不碰流程；便于版本管理 |
| D11 | **渲染服务已定：Rendlet**（Chromium，Free 100 篇/月、10 页/篇，内置 Noto Sans SC）；邮件节点（Gmail vs SMTP）与 n8n 版本锁定仍为 [builder call] | Rendlet 同时满足：内置中文、单 endpoint、免费额度与 M0–M3 的用量匹配；社区节点在 Cloud 不可用的约束也一并满足 |
| D12 | [builder call] Sheet 是「每客户一张」还是「一张多 tab」 | 影响配置字段，不影响主干 |
| D13 | **修订语义：同 `invoice.id` 重发，`revision + 1`**；Sheet 原地覆盖，`attempt_log` 累积；邮件主题带「修正版」标识 | 客户必须能看到发送后追加的费用；要求来源侧另开新 id 需要改造来源系统，等于把接入成本转嫁买家；「发送即冻结」会让客户少收钱，且下月账单突增引发追问 |
| D14 | **M4 允许修改本仓库**：新增只读 `GET /api/internal/invoices/[id]`，**不复用** `GET /api/billing/monthly-invoice` | 后者有出账 + 冲刷 outbox + 发通知的副作用，复用会污染调用；只读接口职责单一、可独立鉴权、可单独限流 |
| D15 | **鉴权用工作流内的 token 比对，不用 n8n 内置凭据**：请求头 `x-invoice-token` 与 `client.config` 中的 token 比对，失败返回 **401** | n8n 内置 `httpHeaderAuth` 需要在 UI 里手工创建凭据，买家导入工作流后还要多一步；token 写在 Code 节点里，导入即生效，且失败响应仍走 Respond 节点（D8 不被破坏）|
| D16 | **`pdf_hash` 取 Google Drive 的 `sha256Checksum`，不在 Code 节点自算** | n8n Code 沙箱在 `filesystem-v2` 二进制模式下拿到的是 13 字符引用而非真实字节，`require('crypto')` 算出的是假哈希（M3 实测） |
| D17 | **失败响应用 500，不用 502** | 部署在 Cloudflare 后时，CF 会把源站 502 替换成自己的 HTML 错误页，JSON body 丢失；500 正常穿透（M4 实测） |
| D18 | **删掉 Hash 节点，新增 `Restore PDF Binary`** | Google 节点（Drive/Sheets）输出不带二进制，`Prepare` 之后若直接接 `Send Email` 附件会丢；该 Code 节点从 `Render PDF` 取回引用再交给 Gmail |

---

## 四、系统结构

### 4.1 分层

```
┌──────────────────────────────────────────────────────────┐
│ 接入层   Webhook (POST /invoice:generate)  Header/Auth      │
│          可选：Schedule Trigger（批量来源）                  │
├──────────────────────────────────────────────────────────┤
│ 归一化   client.config 查找 → 字段别名解析 → 类型转换        │
│          → 统一发票结构（唯一稳定内核）                      │
├──────────────────────────────────────────────────────────┤
│ 校验     必填/格式/算术一致性；失败 → 400，不渲染空白发票      │
├──────────────────────────────────────────────────────────┤
│ 幂等     查 Sheet（或 DB）：same invoice.id 且 status=SENT   │
│          → 直接返回 200 + duplicate 标记                    │
├──────────────────────────────────────────────────────────┤
│ 渲染     rows_html（Code）→ 模板注入 → HTTP Request → PDF    │
├──────────────────────────────────────────────────────────┤
│ 投递     邮件（附件）+ 归档（可选）+ 回写 Sheet               │
├──────────────────────────────────────────────────────────┤
│ 响应     Respond to Webhook（成功与失败都必须有出边）         │
└──────────────────────────────────────────────────────────┘
```

### 4.2 节点拓扑（改造后）

```
[Webhook: 接收发票请求]
      │
      ▼
[Code: Load client.config] ── token 错/未知 client → [Respond 401/400]
      │
      ▼
[Code: Normalize]  别名解析 + 单位换算 + 派生 invoice.number（三级回退）
      │
      ▼
[Code: Validate] ────✗──→ [Respond 400 {errors[]}]
      │ ✓
      ▼
[Sheets: 查询 invoice_id] ──✗──→ ┐
      │                            │
      ▼                            │
[Code: Decide revision]            │
      │                            │
      ▼                            │
[If: duplicate] ──✓──→ [Respond 200 {duplicate:true}]
      │ ✗                        │
      ▼                            │
[Code: Render HTML]（revision>1 加「修正版 rN」水印）
      │                            │
      ▼                            │
[HTTP: Rendlet HTML→PDF] ──✗──→ ┤
      │                            │
      ▼                            │
[Drive: 归档] ──✗──→ ────────────┤
      │                            │
      ▼                            │
[Code: Prepare]  组装邮件 + Sheet 行
      │                            │
      ▼                            │
[Sheets: status=PENDING] ──✗──→ ─┤   ← 先占位（D9）
      │                            │
      ▼                            │
[Code: Restore PDF Binary]         │
      │                            │
      ▼                            │
[Gmail: 发送] ──✗──→ ─────────────┤
      │                            │
      ▼                            │
[Sheets: status=SENT] ──✗──→ ────┘
      │                            │
      ▼                            ▼
[Respond 200]              [Code: Handle Failure]
                                   │
                                   ▼
                            [Sheets: status=FAILED]
                                   │
                                   ▼
                            [Respond 500 {errors, execution_id}]
```

实测节点数 **22**：1 Webhook、8 Code、2 If、4 Google Sheets、4 Respond、1 HTTP、1 Drive、1 Gmail。
四处 `Respond`：200 成功 / 200 重复 / 400 校验 / 500 流水线失败；只有 `Handle Failure` 这一处出口会写 `FAILED`。

与原模板的差异：新增 Load/Normalize/Validate 三个 Code 节点；PdfBro 换为 HTTP Request；Sheets 写入拆成"占位"和"终态更新"两处；所有失败分支都汇入同一个失败处理器。

### 4.3 子流程边界

**子流程 `invoice-core` 承接**：Normalize → Validate → Render → Send → Record。接收已解析的 `client` 与原始 payload，返回标准化结果。

**主流程持有**：Webhook、鉴权、client 路由、Respond。

理由：买家看到的主流程短而清晰（可读、可改、可演示）。

**升级路径（修正 D1 的表述）**：副本一旦导入买家自己的实例，你无法远程替换它的子流程。因此「替换子流程，所有客户自动受益」**只对仍在你实例里的副本成立**（客户 A 的演示、你自己的多客户托管场景）。对外交付的副本走**版本号 + 迁移步骤**：`invoice-core` 顶部声明 `CORE_VERSION`，README 提供「替换子流程 → 更新配置 → 冒烟测试」三步。这决定 M6 必须产出**迁移文档**，而不只是导入文档。

---

## 五、统一发票契约

### 5.1 结构

```jsonc
{
  "client": "hive",                       // 必填，决定映射与模板
  "invoice": {
    "id": "8f3a1c2e-...",                 // 必填，幂等键
    "number": "HIVE-202611-8F3A",         // 必填，人读编号；来源无则派生
    "issuedAt": "2026-11-01T00:00:00.000Z",
    "dueAt":    "2026-11-15T00:00:00.000Z",
    "currency": "CNY",                    // ISO 4217，3 位大写
    "locale": "zh-CN",                    // 决定模板语言，并作为金额格式的默认值
    "numberLocale": "zh-CN",              // 可选，金额格式覆盖；缺省 = locale
    "revision": 1,                        // 可选，账单内容变更后的修订号，缺省 1
    "template": "invoice-cn-a4",          // 可选，缺省由 client+locale 推导

    "seller": { "name": "", "email": "", "address": "", "taxId": "", "logoUrl": "" },
    "buyer":  { "name": "", "email": "", "address": "", "taxId": "" },

    "lines": [
      { "description": "固定办公位月费",
        "quantity": 1,
        "unitPrice": 899.00,
        "amount": 899.00,                 // 服务端重算，不信任入参
        "taxRate": 0 }                    // 百分比数值，0 表示不含税
    ],

    "subtotal": 899.00,
    "discount": 0,
    "taxTotal": 0,
    "total": 899.00,
    "paid": false,
    "notes": "",
    "terms": "逾期付款按日加收 0.05%"
  },
  "delivery": {
    "to": "customer@example.com",         // 必填，缺省取 buyer.email
    "cc": [],
    "subject": "Invoice HIVE-202611-8F3A",
    "message": "请查收本月账单。"
  },
  "_raw": {}                              // 原始入参，原样透传，永远可回溯
}
```

### 5.2 字段分级

| 级别 | 字段 | 缺失时行为 |
|---|---|---|
| 必填 | `client`、`invoice.id`、`invoice.buyer.email`、`delivery.to`、`lines[].description` | 400，拒绝处理 |
| 必填（可派生） | `invoice.number`、`invoice.issuedAt`、`invoice.currency`、`invoice.locale` | 由 `client.config` 默认值或规则补齐 |
| 可选展示 | `seller.*`、`buyer.address`、`buyer.taxId`、`notes`、`terms`、`logoUrl` | 缺失则整块不渲染（不留空标签） |
| 透传 | `_raw`、未知字段 | 完整保留，写入 Sheet 的 `raw_json` |

### 5.3 校验规则

| 规则 | 不通过时 |
|---|---|
| `invoice.id` 非空字符串 | 400 `E_ID_REQUIRED` |
| `delivery.to` 匹配邮箱正则 | 400 `E_EMAIL_INVALID` |
| `lines.length >= 1` | 400 `E_NO_LINES` |
| 每行 `quantity > 0`、`unitPrice >= 0` | 400 `E_LINE_INVALID` |
| `amount == round(quantity * unitPrice, 2)` | 服务端重算覆盖，不报错（来源数据常四舍五入不一致） |
| `subtotal == round(Σ amount, 2)` | 服务端重算覆盖 |
| `total == round(subtotal - discount + taxTotal, 2)` | 不一致时以重算值为准，并在响应中回报 `recalculated:true` |
| `currency` 匹配 `^[A-Z]{3}$` | 400 `E_CURRENCY` |
| 合计 `= 0` 且 `discount = 0` | 400 `E_ZERO_TOTAL`（异常数据，通常意味着映射错位） |
| 合计 `= 0` 且 `discount > 0` | 正常发送，响应带 `zero_total: true`（100% 折扣是真实凭证，不是错误） |

设计取舍：**算术类以服务端重算为准并告知，结构性错误一律拒绝**。理由：买家来源系统的金额常与明细对不上（四舍五入、历史数据），硬拒会造成大量失败单；但缺邮箱、缺明细属于真错误，必须暴露。

### 5.4 两种来源的映射对照

| 契约字段 | Hive（客户 A） | 虚构客户 B（跨境独立站） |
|---|---|---|
| `invoice.id` | `invoice.id`（UUID） | `order.id` |
| `invoice.number` | 派生 `${billingMonth}-${id 前 4 位大写}` | `order.name`（`#1024`） |
| `currency` | 固定 `CNY` | `order.currency`（`USD`/`EUR`） |
| `locale` | 固定 `zh-CN` | 根据 currency 推导 |
| 明细 | `invoice_line_item[]`，金额为**分** | `line_items[]`，金额为**字符串小数** |
| 税额 | 无（`taxTotal = 0`） | 每行 `tax_lines[]` 汇总到行 `taxRate` 与 `taxTotal` |
| `paid` | `status === "PAID"` | `financial_status === "paid"` |
| `delivery.to` | `member.email` | `order.email` |
| `seller.name` | 固定「蜂巢共享办公」 | `shop.name` |
| `logoUrl` | 空 | `shop.brand.logo` |

这张表本身就是**映射配置的规格**，实现时逐行转成 `client.config` 的别名列表。

---

## 六、映射层

### 6.1 配置格式

每个客户一份 `client.config`，放在主流程顶部的 Code 节点（交付时唯一需要修改的地方）。

```jsonc
{
  "client": "hive",
  "defaults": {
    "currency": "CNY",
    "locale": "zh-CN",
    "template": "invoice-cn-a4",
    "seller": { "name": "蜂巢共享办公", "email": "billing@hive.example" }
  },
  "map": {
    "invoice.id":      { "from": "invoice.id" },
    "invoice.number":  { "pattern": "{{billingMonth}}-{{id:4:upper}}" },
    "invoice.issuedAt":{ "from": "invoice.createdAt" },
    "invoice.dueAt":   { "from": "invoice.dueDate" },
    "invoice.buyer.email": { "from": "member.email" },
    "invoice.buyer.name":  { "from": "member.name" },
    "invoice.paid":    { "from": "invoice.status", "equals": { "PAID": true }, "default": false },
    "invoice.lines[].description": { "from": "items[].description" },
    "invoice.lines[].quantity":    { "from": "items[].quantity", "type": "number" },
    "invoice.lines[].unitPrice":   { "from": "items[].amountCents", "transform": "centsToYuan" },
    "invoice.total":   { "from": "invoice.totalCents", "transform": "centsToYuan" }
  },
  "sheet": { "documentId": "...", "sheetName": "invoice_data" },
  "render": { "url": "...", "credential": "PDF Renderer" }
}
```

### 6.2 解析规则

1. **别名**：`"from"` 可为数组，按顺序取第一个存在的路径 → 解决 `invoice_number` / `invoiceNo` / `number` 这类差异，无需为每个买家写代码。
2. **路径语法**：`a.b.c` 取嵌套；`items[].description` 表示对数组逐项取值（用于明细行）。
3. **transform**：内置 `centsToYuan`、`trim`、`isoDate`、`upper`、`number`。新增 transform 是**改子流程**，不是改配置 —— 这是唯一允许的例外，且应极少发生。
4. **派生**：`pattern` 支持 `{{field}}` 与 `{{field:N}}`（截取）、`{{field:N:upper}}`。
5. **未映射字段**：不报错，原件进 `_raw`。
6. **未知 client**：400 `E_CLIENT_UNKNOWN`，不猜。

### 6.3 为什么不用 Switch 节点

n8n 的 `Switch` 按值分支会导致「每个客户一条支路」，节点图随客户数线性膨胀，母版不可维护。**用一个 Code 节点做表驱动映射**，客户数增长不改图。

---

## 七、模板层

### 7.1 目录

```
templates/
├── invoice-cn-a4.html        # 中文，人民币
├── invoice-en-a4.html        # 英文，通用
├── invoice-en-us-sales.html  # 英文，含每行税额（客户 B）
└── partials/
    ├── header.html
    ├── parties.html
    ├── totals.html
    └── footer.html
```

模板是**纯 HTML + 内联 `<style>`**，不含逻辑。单文件首选（便于买家自己改），partials 仅用于母版维护。

### 7.2 变量规范（D7）

| 变量 | 说明 |
|---|---|
| `{{{ rows_html }}}` | 明细行 `<tr>` 拼接结果，由 Code 节点生成，**原样注入不转义** |
| `{{ invoice.number }}` | 文本变量，**默认转义**（防 `&`、`<` 破坏排版） |
| `{{ lines_total }}` | 行数，用于"共 N 项" |
| `{{ total_fmt }}` | 已格式化金额，如 `¥899.00` |

规则：**循环与条件在 Code 节点完成，模板只做扁平替换**。这样换任何渲染服务（mustache / 简单字符串替换 / 厂商专有语法）都不用重写模板。

### 7.3 版式基线（"好看"的具体定义）

> 以下参数已在 M0 用 40 行中文账单实测（2026-11-16），括号里的数值是实测通过的取值。

1. A4 纵向，**页边距 18mm 必须写 CSS `@page`**（`options.margin` 无效，见 7.6.1），正文 9.5–10.5pt、行高 1.45–1.5（40 行明细压进 2 页需要 9.5pt / 1.45）
2. 顶栏：左 Logo（高 40–56px，缺失则留白不塌版），右 `INVOICE` 大号字 + 发票号；**右块必须 `white-space: nowrap` + `flex: 0 0 auto`**，否则开票日期会折行
3. 两栏信息区：左「开票方」、右「收票方」；缺失整块不渲染
4. 明细表：`<thead>` 固定，细线分隔 + 斑马纹，数字列右对齐，金额带千分位
5. 合计区：右对齐，`subtotal / discount / tax / total` 逐行，`total` 加粗并放大一号
6. 状态徽标：已付显示 `PAID` 绿色角标，未付显示 `DUE`，仅展示不改语义
7. 页脚：条款小字（8pt，灰色）+ 右下「共 N 项」。**不写页码** —— Chromium 不支持 CSS 分页页眉页脚，渲染端也未开放 header/footer 模板（见 7.6.3）
8. 全篇**只用一个强调色**（跟随 Logo 主色或固定 `#1f6feb`），黑色只用于正文
9. 斑马纹必须限定作用域：`.items tbody tr:nth-child(even)`，裸 `tbody` 会把合计区一起染色（见 7.6.4）

### 7.4 中英文与跨页

- 字体栈：`"Noto Sans SC", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif`
- **字体由渲染端内置，不自挂**：Rendlet 内置 Noto Sans SC（可变字体），400 / 700 字重实测均生效。PDF 里内嵌字体名报 `NotoSansSC-Thin` 是可变字体的默认实例名，不是"只有 Thin 字重"
- **不要用 `<link>` 引 Google Fonts** —— 实测会让 CJK 字体整个不被嵌入，PDF 里中文变空白（见 7.6.2）
- `thead { display: table-header-group; }` —— 明细跨页时表头自动重复，这是专业感的关键细节（需在真实 PDF 上目视确认一次）
- `tr { break-inside: avoid; }` —— 避免一行被劈成两页
- 合计区 `break-inside: avoid;`
- 金额格式按 `locale` 走 `Intl.NumberFormat`，在 Code 节点内完成（模板不计算）

### 7.5 版本与变更

- 模板文件顶部注释写 `<!-- template: invoice-cn-a4 v1.2 -->`，Sheet 记录 `template_version`
- 改样式 = 改文件 → 重新导入 n8n（或改用 HTTP 拉取模板，见"留给 builder"）
- 模板 id 与 `client.config` 解耦：同一模板可被多个客户复用

### 7.6 渲染端约束（M0 实测，2026-11-16）

Rendlet（Chromium）实跑 40 行中文账单后测出的四条硬约束，直接决定模板怎么写。换渲染服务商时必须重新验证这四条。

| # | 约束 | 证据 | 模板必须怎么写 |
|---|---|---|---|
| 7.6.1 | **`options.margin` 是空操作** | 填 `0mm` / `18mm` / `40mm`，输出字节数完全一致（180308） | 边距只能写 CSS：`@page { size: A4; margin: 18mm }` |
| 7.6.2 | **`<link>` 引 Google Fonts 会让中文消失** | 加 link 后 PDF 里只剩 OpenSans，无任何 CJK 字体对象 | 字体靠渲染端内置；确需自定义就写 `@font-face` + 公网 woff2。**禁止 `<link rel=stylesheet>`** |
| 7.6.3 | **不支持分页页码** | Chromium 不支持 `@page` 的 margin box（`@bottom-right`），Rendlet 也未开放 header/footer 模板 | 页脚只写「共 N 项」；多页靠重复表头提示位置 |
| 7.6.4 | **斑马纹选择器会污染合计区** | `tbody tr:nth-child(even)` 同时匹配明细表和合计表 | 明细表加 class：`.items tbody tr:nth-child(even)` |

**渲染调用契约**（唯一允许的写法）：

```
POST https://rendlet.com/v1/pdf
Authorization: Bearer <key>
Content-Type: application/json

{ "html": "<完整 HTML>",
  "options": { "format": "A4", "printBackground": true } }   ← 不要传 margin
```

n8n 侧对应：HTTP Request 节点，`Response Format = File`，输出属性 `data`（直接作为邮件附件，不做 base64 往返）。

**额度**：Free 100 篇/月、10 页/篇、10 请求/分钟、HTML ≤ 1MB；沙箱 key 5 次/天且带水印。M0–M3 实测约用 7 次 → 免费额度足够。

---

## 八、投递层

### 8.1 邮件

- 节点：Gmail 或 SMTP（[builder call] D11）
- 附件：渲染节点输出的二进制属性（`data`），不做 base64 往返
- **渲染 → 邮件的衔接（实测）**：HTTP Request 节点设 `Response Format = File`、`Output Property = data`，直接绑到邮件的附件字段。中间任何一次 base64 往返都会让 PDF 损坏或体积翻倍
- 渲染调用的唯一合法写法见 7.6（**不传 `options.margin`**，边距写 CSS `@page`）
- 主题/正文取自 `delivery.subject` / `delivery.message`，空则用模板默认值
- 当 `revision > 1` 时：主题追加 `(修正版 r2)`，正文首句插入「本邮件为修订版，请以本版为准，前一封作废」，PDF 加「修正版 rN」对角水印（`position:fixed` + `rotate(-20deg)`，每页都出现，透明度 10%，不遮挡内容）
- **额度约束**：个人 Gmail OAuth 约 500 封/日，且发件人显示为个人账号。月结场景可能一次性超出 → 必须分批 + 退避，或在文档中明确要求买家使用 SMTP/自有域名

### 8.2 归档

- 目标：Google Drive 指定目录（默认），可换成 S3/OneDrive
- 文件名：`invoice-{number}.pdf`；`revision > 1` 时 `invoice-{number}-r{n}.pdf`。`number` 中 `[A-Za-z0-9._-]` 以外的字符替换为 `-`
- **顺序：先归档，后发送**。归档失败即整体失败，不发邮件
- 理由：本 gig 卖的是"可对账的凭据"，发出去却没有字节留存等于凭据失效。Drive 上传失败率很低，宁可延迟也不留空档
- 归档成功后取 Drive 返回的 `sha256Checksum` 写入 `pdf_hash` —— 证明客户收到的是哪一版字节。
  **不用 `require('crypto')` 自算**：n8n Code 节点沙箱拿到的是 `filesystem-v2` 引用而非真实字节（实测 `binary.data.data` 只有 13 个字符），自算会得到假哈希
- 存 Sheet 的链接用 `uc?export=download&id=<fileId>`，**不用 `webViewLink`**（后者需 Google 登录，客户点不开）

### 8.3 Google Sheet 回写

统一列（顺序固定，买家可加列但不可删）：

| 列 | 说明 |
|---|---|
| `invoice_id` | 幂等键，匹配列 |
| `invoice_number` | 人读编号 |
| `issued_at` / `due_at` | ISO 时间 |
| `currency` | ISO 4217 |
| `seller_name` / `buyer_name` / `buyer_email` | 检索用 |
| `subtotal` / `tax_total` / `discount` / `total` | 数字，两位小数 |
| `status` | `PENDING` / `SENT` / `FAILED` / `DEAD` |
| `pdf_url` | 归档链接 |
| `email_message_id` | 邮件节点返回值 |
| `attempts` | 重试次数 |
| `attempt_log` | JSON 数组，累积每次尝试 `{at, code, message}`，上限 5 条 |
| `error_message` | 最近一次失败原因（机器可读码 + 人读说明） |
| `sent_total` | 实际发出时的金额快照，用于判定"账单是否已变化" |
| `revision` | 修订号 |
| `pdf_hash` | 归档 PDF 的 SHA-256，证明发出的是哪一版字节 |
| `template_version` | 可追溯样式变更 |
| `updated_at` | 每次写入刷新 |
| `raw_json` | 原始入参全文 |

写入策略：`appendOrUpdate`，`matchingColumns: ["invoice_id"]`。
**关键**：`PENDING` 占位写入必须在发送前完成，否则"已投递但无记录"。

> 实建位置：占位写在 **渲染 + 归档之后、Gmail 之前**（占位行需要 `pdf_url`）。
> 因此 `PENDING` 不承担并发互斥职责 —— 并发双发只靠 `invoice_id` 查重的最佳努力，见 8.4。

### 8.4 幂等与重试

| 情况 | 行为（实建） |
|---|---|
| 存在同 `invoice_id` 且 `status=SENT`，本次未带 `resend`/`force` | 返回 200 `{duplicate:true}`，不重发 |
| 存在且 `status=SENT`，本次带 `resend:true` / `force:true` | `revision + 1`，完整重渲染、重发、Sheet 原位更新、`attempt_log` 追加 |
| 存在且 `status=PENDING` 或 `FAILED` | 允许重试，`revision` **不变**（从未投递成功，不算修订） |
| `attempts` | 每次进入投递计数 +1，累计 |
| 渲染或发送抛错 | 走失败分支落 `FAILED`；**未开启节点级 `retryOnFail`** |

**设计稿里写过但未实现**（记录在案，不是遗漏）：

| 未实现项 | 原因 |
|---|---|
| `409 IN_FLIGHT`（`PENDING` 10 分钟内拒绝） | 占位写入已后移到归档之后（8.3），拿不到"渲染前"的时间窗；实现它需要额外一次 Sheets 读，收益不抵成本 |
| `sent_total` 比对判定"账单是否已变化" | 金额变化目前由来源系统决定是否带 `resend`，工作流不推断 |
| `attempts >= 5` 置 `DEAD` | 无自动重试队列，`DEAD` 没有触发点 |
| 节点级 `retryOnFail` | 失败即落 `FAILED` 并返回结构化错误，由来源系统决定何时重试，避免 n8n 内隐式重试把一次请求拖到 60 s 以上 |

**重试的触发者（已定）**：n8n 内部不设延迟重发队列。`FAILED` / `DEAD` 的恢复只有两条路径 ——
1. **来源系统重新 POST 同一个 `invoice.id`**（这是必须写进 README 的对外接口约定，买家要自己实现）；
2. **人工重放**：把 Sheet 的 `status` 改回 `PENDING`、`updated_at` 清空，再 POST 一次。

`attempts` 是**累计值，跨整个账单生命周期，不重置**；`>= 5` 后只停止自动重试，不禁止人工重放（人工确认后由人手工把 `attempts` 归零，这个动作写进 README）。时间窗不设限制：`PENDING` 超过 10 分钟后允许任何来源再次触发。

**并发边界（已定，接受为已知限制）**：Sheets 的「查 → 判 → 写」不是原子操作，两个几乎同时到达的请求仍可能都通过。本设计按 **best-effort 幂等**交付 —— 挡住来源系统串行重试与网络抖动（真实高频场景），**不承诺分布式锁**。理由：真锁需要 Redis 或外部存储，违反 G6（只用内置节点）。该限制必须写进 README，并建议买家在来源侧保证同一 `invoice.id` 串行发送。

**去重的事实来源（M6 实测）**：Sheet 行是唯一判据，没有任何旁路状态。删掉一行、或把 `status` 改成 `SENT` 以外的值，同一个 `invoice_id` 就会按**全新发票**重新投递：`revision` 回到 1、Drive 多一个同名 PDF、原 `attempt_log` 消失。

- 想重发：用 `resend: true`，保留记录、升 `revision`
- 删行等于删凭据。买家清理测试数据时最容易踩这个坑，交付文档必须显式写明

### 8.5 响应契约

| HTTP | body | 场景 |
|---|---|---|
| 200 | `{success:true, invoice_id, status:"sent", revision, pdf_url, pdf_hash, email_id}` | 正常发送 |
| 200 | `{success:true, duplicate:true, invoice_id, status, revision}` | 已发送过 |
| 400 | `{success:false, errors:[{code, field?, message}]}` | 校验失败 / 未知 client |
| 401 | `{success:false, errors:[{code:"E_UNAUTHORIZED", message}]}` | 鉴权失败。**由工作流内的 token 校验返回**（D15），发生在 Normalize 之前，仍走 Respond 节点 |
| 500 | `{success:false, invoice_id, errors:[{code:"E_PIPELINE", message, execution_id}]}` | 下游失败（已落 `FAILED`） |

**任何分支都必须抵达 Respond 节点**（D8），这是原模板最严重的缺陷。

> **502 不能用。** 实测：本机 n8n 挂在 Cloudflare 后面时，Cloudflare 会把源站的 502 替换成自己的 HTML 错误页，客户端拿到的不再是 JSON。**500 可以正常穿透**。改状态码前先确认部署环境。
>
> 202 / 409 见 8.4：未实现。

---

## 九、两个客户的对照验证

### 9.1 客户 A：Hive（本仓库）

| 项 | 值 |
|---|---|
| 来源 | Next.js `generateMonthlyInvoice()` 产出，写入 Turso 的 `invoice` / `invoice_line_item` |
| 触发 | （Phase 1）管理员手动 POST，批量遍历 ACTIVE 订阅；（Phase 2）n8n Cron 调 `GET /api/billing/monthly-invoice` |
| 单位 | **分**（`totalCents`），需 `centsToYuan: /100` |
| 编号 | 无原生编号，派生 |
| 税 | 无，`taxTotal = 0` |
| 中文 | 是，`zh-CN` |
| Sheet 角色 | 镜像（DB 是事实源） |
| 特殊 | 存在折扣（`discountAppliedCents`）与灵活区封顶，映射层要正确取"折后总额" |

**验证点**：本仓库 DEVELOPMENT_PLAN 的验收场景 —— 会员费 ¥899 + 会议室 ¥30 + 超时 ¥40 = **¥969**，PDF 合计必须等于 969.00，明细三行完整。

> 勘误（2026-11-16）：本节早期版本写作 ¥939，算术有误。899 + 30 + 40 = 969，M1 实测输出与 969 一致。

### 9.2 客户 B：跨境独立站（虚构）

| 项 | 值 |
|---|---|
| 来源 | 订单系统 webhook（`checkout.completed` 一类事件） |
| 粒度 | **一单一票**，不是一月一账 |
| 币种 | `USD` / `EUR` 混用，小数金额（字符串） |
| 税 | **每行**带 `taxRate`，汇总到 `taxTotal` |
| 语言 | 英文，`en-US` |
| 品牌 | `shop.brand.logo` 有值，Seller 是店铺名 |
| 已付 | `financial_status === "paid"` → 显示 PAID 徽标 |
| Sheet 角色 | **账本**（买家用它对账） |
| 模板 | `invoice-en-us-sales.html` |

### 9.3 这一对能撞出的设计缺陷（预期）

| 冲突点 | 为什么会暴露 | 契约如何处理 |
|---|---|---|
| 一单一票 vs 一月一账 | `invoice.number` 来源于订单号而非派生 | 映射层 `pattern` vs `from` 二选一，配置即可 |
| 小数字符串 vs 整数分 | 金额精度来源不同 | 契约固定两位小数，转换在映射层 |
| 每行税 | Hive 无税，模板不含税列 | 模板按 `taxRate > 0` 判断是否渲染税列；列不显示而非显示 0 |
| 已付 vs 待付 | 语义与展示不同 | `paid` 布尔 + 徽标，不改状态机 |
| 多币种格式 | `$1,234.56` vs `¥1,234.56` | `Intl.NumberFormat(locale, currency)` 在 Code 节点 |
| Sheet 是账本 vs 镜像 | 决定失败时是否阻断 | 账本模式：Sheet 写失败视为整体失败；镜像模式：不阻断 |

若这六点中有任何一点要求在主干加 `If` 分支，说明契约设计不成立，需回退修正 —— 这是本设计最需要先验证的假设。

---

## 十、里程碑计划

总计 **7.5 人天**（含缓冲 9–10 天）。每个里程碑有可观测的验收标准，未达标不进下一个。

### M0 — 渲染路线验证（0.5 人天，最高风险优先）

**目标**：证明"中文 + 明细表格 + 专业版式"在选定渲染服务上成立。

**动作**
1. 起自建 n8n（Docker），或确认 Cloud 实例
2. 二选一：起 Gotenberg 容器 / 申请渲染 API key
3. 手写一个最简 HTML（中文 + 3 行明细表 + 合计）
4. HTTP Request 打出 PDF，肉眼检查

**验收**
- 汉字正常显示，无方块、无缺字
- 明细为真表格（列对齐、有表头）
- `thead` 跨页重复生效（造 40 行数据验证）
- A4 单页排版不溢出

**失败即止损**：若中文渲染不可用，切换到备选服务商或 Gotenberg，本设计其余部分不受影响。

### M1 — 契约与校验（1 人天）

**动作**：定义 `client.config` 结构；实现 `Load config` / `Normalize` / `Validate` 三个 Code 节点；实现 transform 与别名解析；建立错误码表。

**验收**
- 喂 10 组畸形 payload（缺邮箱、空明细、零金额、币种错误），全部返回对应 400 码，且**不产生任何 PDF**
- 喂 Hive 真实账单 JSON，输出符合 5.1 的规范结构，金额为元
- 新增一个客户的映射只改配置，节点图不变（用一次 code review 确认）

### M2 — 渲染层（1.5 人天）

**动作**：模板引擎（扁平注入 + 转义）；`rows_html` 生成；两套模板（中/英）；版式八条落地；金额格式化。

**验收**
- 中英文各出一张，肉眼达到"可以直接发给客户"的水平
- 明细 40 行跨页，表头重复、无断行
- Logo 缺失时版式不塌；Logo 存在时按比例缩放不拉伸
- 金额千分位、两位小数、货币符号正确
- 模板改字体/颜色不需要改任何节点

### M3 — 投递与幂等（1 人天）

**动作**：Sheet 统一列 + 占位写 + 终态更新；邮件发送；Drive 归档；重试与 DEAD；所有失败分支接 Respond。

**验收**
- 同一 `invoice.id` 连续请求两次（金额未变）：第二次返回 `duplicate:true`，客户只收到 1 封
- 同一 `invoice.id` 但金额已变（模拟账单追加明细）：第二次按修订发送，`revision=2`，客户收到 2 封且第二封金额正确
- 断开渲染服务：返回 500，Sheet 记为 `FAILED`，客户未收到邮件
- 恢复后重发成功，Sheet 转为 `SENT`，`attempts=2`
- 所有分支都有响应，无挂起（用 curl 加超时验证）

### M4 — 客户 A（Hive）集成（1.5 人天）

**动作**：映射配置；`invoice.number` 派生规则；折扣金额取值；**在本仓库新增一条只读接口** `GET /api/internal/invoices/[id]`（一次一张，逐张调用，与风险表"逐张触发"一致），返回契约 DTO；鉴权沿用 `Authorization: Bearer CRON_SECRET`，失败返回 **403**（与仓库现有约定一致，n8n 侧按 403 处理，不在工作流内伪造 401）；Sheet 作为镜像。

**注意**：现有 `POST /api/billing/monthly-invoice` 有副作用（会出账 + 冲刷 outbox + 发通知），**不能复用**为 DTO 接口。

**验收**
- 本仓库 ¥969 场景端到端跑通，PDF 合计 969.00
- 中文明细三行（会员费/会议室/超时）正确
- 已付账单显示 PAID 徽标
- Sheet 行与 DB 账单一一对应，`raw_json` 可回溯

### M5 — 客户 B（虚构跨境站）集成（1 人天）

**动作**：第二份 `client.config`；英文模板 + 税列；多币种格式化；`financial_status` 映射。

**验收**
- 美元订单出票，税列正确且合计 = 小计 + 税
- 欧元 + `en-US` 订单金额格式为 `€1,234.56`；若买家要求欧陆写法，通过 `numberLocale: "de-DE"` 得到 `1.234,56 €`
- Hive 与客户 B 共用同一个 `invoice-core` 子流程（用工作流 JSON diff 证明）
- 9.3 六个冲突点**无一需要在主干加分支**

### M6 — 交付包（1 人天）

**动作**：交付 README（占位符清单、凭据配置步骤、常见错误码、重试与 DEAD 处理）；导入说明；示例 payload；gig 用截图与演示视频脚本。

**验收**
- 一个陌生人按 README 从零能导入并跑通（找一个人实测）
- 买家需修改的项全部集中在 `client.config` 一个节点，README 有对照表
- 明确写出前置要求：n8n 版本、渲染服务、Gmail 额度限制

### 里程碑依赖

```
M0 ──► M1 ──► M2 ──► M3 ──┬──► M4 ──┐
                          └──► M5 ──┴──► M6
```

M0 是唯一"可否继续"的闸门；M4/M5 可并行。

### 交付后的单位经济

- 新客户接入：**0.5–1 人天**（配置 + 模板）
- 母版升级：替换 `invoice-core` 子流程，已交付副本按 README 步骤更新
- 边际成本：渲染 API 按量（约 100 张/月免费额度内），邮件按买家账号

---

## 十一、风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 中文渲染或字体缺失 | 整条路线不成立 | M0 先验证，失败即换服务商/Gotenberg |
| 第三方渲染服务看到发票内容 | 隐私与合规 | 文档中明示；提供 Gotenberg 自建变体；不传 `_raw` 到渲染端 |
| Gmail 500 封/日上限 | 月初批量失败 | 分批 + 退避；文档要求生产用 SMTP/自有域名 |
| Google Sheet 并发写入冲突 | 双发或丢失记录 | `PENDING` 占位 + 10 分钟 in-flight 窗口 + `invoice_id` 匹配列 |
| 买家来源数据质量差 | 大量 400 | 错误码明确 + README 提供排错对照表；不做静默修正 |
| n8n Cloud 版本差异 | 交付物跑不起来 | 只用内置节点 + HTTP Request；文档写明最低版本 |
| 模板改动需要重新导入 | 维护成本 | 备选：HTTP 拉取模板（见下）；或纳入交付流程 |
| 月度批量在单次执行中超时 | 部分发票未发 | 逐张触发（每张一次 webhook 调用），不做单执行内循环；或 `Split In Batches` |

---

## 十二、留给 builder 的决定

这些不影响架构，实现者自行决定并记录理由：

1. ~~渲染服务：托管 API vs 自建 Gotenberg~~ → **已定 Rendlet**（见 D11 / 7.6）。仍开放的是：买家量级超过 1,000 篇/月时，是否提供 Gotenberg 自建变体
2. 邮件节点：Gmail 节点 vs SMTP 节点 vs 第三方 API
3. n8n 版本锁定与 Docker 镜像
4. Sheet 组织：每客户一张 vs 一张多 tab
5. 模板分发：随工作流内联（Code 节点字符串）vs HTTP 拉取（可热更新，但多一个失败点）
6. 是否保留 Drive 归档，或改 S3/Vercel Blob
7. 批量出账的触发形态：Cron + Split In Batches，或由来源系统逐张调 webhook
8. 日志与告警：是否需要 Slack/邮件通知 `DEAD` 记录

---

## 十三、待确认项

> 本稿经过一轮独立评审（由未参与讨论的实现者通读）。评审提出的 8 个问题已全部处理：6 个在稿内直接修正，2 个由需求方确认后固化为 D13 / D14。

### 已确认

- [x] **原 Q1 账单发出后又变了** → 同 `invoice.id` 重发，`revision + 1`（D13）
- [x] **原 Q2 是否允许改 hive 仓库** → 允许，新增只读接口 `GET /api/internal/invoices/[id]`（D14）

### 已由实施结果确认

| 原待确认项 | 结论 |
|---|---|
| D2 渲染路线（HTTP Request + Chromium API） | 已定 Rendlet（D11），M0–M2 实测通过 |
| 是否接受发票内容经过第三方渲染服务 | 已接受 |
| 归档前置（先归档后发送） | 已实现 |
| M0 排最前、按 M1→M6 顺序 | 已按此执行至 M4，M6 已交付 |
| D1 交付形态（一客户一份 + 共用子流程） | **未采用**：当前交付为单工作流 + `client.config` 内多 client 条目，靠 `map` 区分；拆子流程留到有第二个真实客户时再做 |

---

## 十四、实建状态（as built，2026-11-16）

| 里程碑 | 状态 | 证据 |
|---|---|---|
| M0 渲染路线 | ✅ | CJK 正常、字重 400/700 可区分、文字可提取、40 行自动分页且表头重复 |
| M1 契约与校验 | ✅ | 6/6 用例（两种输入形态 + 4 类校验失败） |
| M2 渲染层 | ✅ | 中文 PDF 121 KB / 1 页 / 8 个内嵌字体；英文 30 KB / 2 个字体；版式经 Playwright 截图确认 |
| M3 投递与幂等 | ✅ | 首发 7.1 s；原样重发 0.75 s 返回 duplicate；`resend` 后 revision+1、`attempt_log` 累积 |
| M4 错误分支与审计 | ✅ | 故意打挂 Rendlet → 500 + 结构化错误 + Sheet 落 `FAILED`；两段式写表实测 PENDING 比 SENT 早 1.6 s |
| M5 客户 B 真机验证 | ⏳ | `shopdemo` 映射已内置并通过本地契约测试，未接真实订单源跑通 |
| M6 交付包 | ✅ | `docs/n8n/README.md`、3 个示例 payload、脱敏工作流 JSON |

**交付物**：`docs/n8n/invoice-automation.json` —— 22 节点，凭据引用、Rendlet key、webhook token、Sheet/Folder id 全部已置为占位符。

**已知未做**：见 8.4 表下半部分（409 / DEAD / retryOnFail / sent_total 比对）；`raw_json` 列目前不写入。

---

> 本稿与实建的差异已就地修正。后续改动以 `docs/n8n/README.md` 为准。
