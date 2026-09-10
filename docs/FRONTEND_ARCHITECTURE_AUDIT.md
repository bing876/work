# Frontend Architecture Audit Report

> 审计对象：`bing876/work` · XYZ Workbench vNext Frontend（Phase 0）
> 审计人：Principal Frontend Architect / Staff Engineer
> 审计日期：2026-09-10 · 分支 `arena/01a08a13-work`（基于 `c8e2812`）
> 审计方式：全量代码通读 + 本地 `npm install` / `npm run build` / `npm test` 实测验证

实测基线：

- `npm run build`：通过，`tsc --noEmit` 零错误，`dist/` 共 **33MB**（JS 276KB / CSS 32KB / 图片 ~32MB）
- `npm test`：3 文件 11 用例全部通过
- 源码规模：`src/**` 约 1485 行（含测试、CSS），`src/assets` 32MB（20 张 PNG 头像占 99%）

---

## 第一阶段：项目理解

### 1.1 技术栈清单（以 `package.json` / `tsconfig.json` / `vite.config.ts` 为准）

| 维度 | 现状 | 评价 |
|---|---|---|
| 框架 | React **19.1.1** + `react-dom` | ✅ 新，但未用任何 React 19 新能力（`use()` / `useOptimistic` / Server Components 概念缺席） |
| 语言 | TypeScript **5.9.2**，`strict: true` | ⚠️ 仅开基础 strict，缺 `noUncheckedIndexedAccess` / `noUnusedLocals` / `verbatimModuleSyntax` 等企业级开关 |
| 构建 | Vite **7.1.3** + `@vitejs/plugin-react` 5 | ⚠️ 零配置：无分包、无 chunk 策略、无环境变量规范 |
| UI 框架 | 无（手写 CSS + `@phosphor-icons/react` 4 个图标） | ❌ 无组件库、无 Design System，手写 `dialog`/`switch`/`menu` |
| CSS 方案 | 单文件全局 CSS：`src/styles.css`（351 行） | ❌ 无 Token、无 CSS Modules、无 Tailwind、无主题机制 |
| 状态管理 | `useReducer` + Context（仅注入 client） | ⚠️ 原子级可用，但 `set/patch` 后门破坏了 reducer 纪律（详见 P0-2） |
| 路由 | 无（`section`/`conversationId` 存 reducer 里） | ❌ 无深链接、无多 Workspace URL 语义，企业级硬伤 |
| API 通信 | 自研 `WorkbenchClient` 接口 + `MockWorkbenchClient` | ✅ 抽象方向对，但**只有一元 Promise**，无 streaming/取消/订阅能力（详见 P0-1） |
| 数据校验 | 无（无 zod/valibot） | ❌ Mock 与未来真实 API 之间无 contract 校验 |
| 国际化 | 无（中英混杂硬编码） | ❌ 出海/企业多语言从零开始 |
| 测试 | Vitest 3（jsdom）+ Playwright | ✅ 金字塔起步好，但部分 e2e 已过期失效（详见 P1） |
| Lint/Format/Git 钩子/CI | **全部缺失** | ❌ 无 ESLint / Prettier / Husky / `.github/` |

### 1.2 项目技术架构图（现状 · 实测还原）

```text
┌──────────────────────────────────────────────────────────────┐
│                        index.html                             │
│              <div id="root"> · color-scheme: dark            │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  src/main.tsx (12行)                                          │
│  StrictMode → WorkbenchClientProvider(MockClient) → App      │
│  ⚠ client 硬编码 new MockWorkbenchClient()，无 env 切换       │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  src/app/App.tsx (31行) · 单一 useReducer（11 个字段）        │
│  State = bootstrap数据 + UI状态(9个) 混在同一 reducer         │
│  「set/patch」万能后门：任何组件可覆盖任意字段                  │
└──────────────────────────────┬───────────────────────────────┘
                               ▼ props drilling (state, dispatch, client)
┌──────────────────────────────────────────────────────────────┐
│  src/features/AppShell.tsx (298行 · 上帝组件)                 │
│  ┌──────┐ ┌────────┐ ┌─────┐ ┌────────────────────────────┐   │
│  │ Rail │ │Sidebar │ │Splitter│ │ MainArea                │   │
│  │5个死tab│ │搜索+项目│ │手写拖拽│ │ ProjectExperience      │   │
│  │+切换器 │ │列表    │ │     │ │ MessageView × N          │   │
│  └──────┘ └────────┘ └─────┘ │ Composer(ToolMenu+ModelSelector)│
│  CreateProjectDialog(条件渲染)  SettingsDialog(条件渲染)     │   │
│  + ContactRow/Conversation/ModelSelector/ToolMenu 等          │
│    10 个组件 + 工具函数全部挤在同一文件                        │
└──────────────┬───────────────────────────────┬───────────────┘
               ▼                               ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│ src/client/                  │  │ src/styles.css (351行全局)  │
│ WorkbenchClient(接口,36行)    │  │ 零 Token · 硬编码 rgba      │
│ MockWorkbenchClient(134行)    │  │ 固定 1400×900 frame         │
│ JSON深拷贝 × 每次调用         │  │ min-width:980px · 仅暗色    │
│ 一元Promise · 无streaming     │  │ backdrop-blur 80px          │
└──────────────────────────────┘  └────────────────────────────┘
               ▲
┌──────────────────────────────┐
│ src/assets/ · 32MB            │
│ 20×DIM_STAR PNG(1.4~2MB/张)   │
│ 静态import全量打进首屏包       │──▶ dist/ 33MB（P0 性能事故）  │
└──────────────────────────────┘
```

一句话总结：**这是一个视觉完成度很高的 Phase 0 高保真原型，但以"企业级 AI 工作台前端"的标准衡量，它处于"原型壳"阶段——缺路由、缺 streaming 数据层、缺 Design System、缺工程化护栏。**

---

## 第二阶段：目录架构审查

### 2.1 现状

```text
src/
├── main.tsx                  # 入口（硬编码 Mock client）
├── styles.css                # 全局唯一BSS（351行）
├── assets.d.ts               # png/svg 模块声明
├── app/
│   ├── App.tsx               # 根 reducer + bootstrap
│   ├── App.test.tsx
│   └── workbench-context.tsx # 仅做 client 注入
├── client/
│   ├── workbench-client.ts        # 所有 Domain Model + 接口（36行，类型全挤这里）
│   ├── mock-workbench-client.ts   # Mock 实现
│   └── mock-workbench-client.test.ts
├── features/
│   ├── AppShell.tsx          # 298行上帝组件（Rail/Sidebar/Chat/Composer/Settings全在内）
│   ├── CreateProjectDialog.tsx / .test.tsx
│   └── ⚠ 没有任何子目录
├── assets/                   # 图片资源（32MB）
└── test/setup.ts
```

### 2.2 三问结论

**Q1：是否符合大型 SaaS / AI 产品架构？—— 不符合。**

- `features/` 名为 features，实际是**扁平的两文件堆放**，无 `features/<domain>/components|hooks|api|model` 切分。
- 无 `app/routes/`（路由）、无 `shared/`（跨域复用）、无 `entities/`（领域模型层）、无 `pages/`。以 FSD / Feature-based / Domain-driven 任一标准衡量都不达标。
- `src/app/` 只有状态机，没有路由编排、错误边界、鉴权守卫、布局插槽——"app 层"名存实亡。

**Q2：是否符合 Feature-based Architecture？—— 形式上有名无实。**

- 反例：`AppShell.tsx` 同时横跨 rail-nav、sidebar、conversation、composer、model-selector、settings 六个 feature；`workbench-client.ts` 把 Agent/Project/Task/Artifact/Message/Model 六个领域模型塞进一个文件。
- Feature-based 的核心是**高内聚 + 单向依赖规则**（feature 之间不直接 import），当前无任何依赖约束（也无 ESLint 来强制）。

**Q3：未来扩展能否支撑 Agent/Workspace/Memory/KB/Workflow/Plugin/Model/Permission？—— 不能。**

推演：若按下周需求新增"Workflow 画布"和"Memory 面板"，新代码只能有两个去处——继续塞进 `AppShell.tsx`（上帝组件膨胀到 600+ 行），或在 `features/` 下再加两个扁平文件并继续 drilling `dispatch`。两种都会在 1 个月内让 `App.tsx` 的 reducer 变成 25+ 字段的全局泥球。**当前结构的可扩展天花板约为 3~5 个新模块，之后必然重构。**

### 2.3 目标目录结构（P1，给出可直接执行的迁移终态）

```text
src/
├── app/                    # 应用装配层：只做 providers + router + error boundary
│   ├── App.tsx
│   ├── router.tsx          # ★ 新增：/w/:workspaceId/p/:projectId/c/:conversationId
│   ├── providers.tsx       # ★ 新增：QueryClient + Theme + Auth + Client
│   └── workbench-context.tsx
├── pages/                  # ★ 新增：路由级页面（thin，只拼装 features）
│   ├── WorkbenchPage.tsx
│   └── SettingsPage.tsx
├── features/               # 每个 feature 自闭环：components/hooks/api/model
│   ├── rail-nav/
│   ├── sidebar/
│   ├── conversation/       # MessageView/blocks/虚拟列表
│   ├── composer/
│   ├── project/            # CreateProjectDialog + ProjectExperience
│   ├── model-selector/
│   ├── agent-timeline/     # ★ P2：ToolCall/Reasoning 时间线
│   └── memory/             # ★ P2
├── entities/               # ★ 新增：领域模型（从 workbench-client.ts 拆出）
│   ├── agent/model.ts  project/model.ts  task/model.ts
│   ├── message/model.ts  artifact/model.ts
│   └── shared/branded-ids.ts  # ProjectId/ConversationId 不可混用
├── shared/
│   ├── ui/                 # ★ Design System：Button/Dialog/Switch/Menu/Avatar…
│   ├── styles/tokens.css   # ★ 设计 Token
│   ├── lib/                # cn()、format、id 生成
│   └── api/                # ★ http/sse/ws 基础设施 + 错误 Envelope
├── client/
│   ├── workbench-client.ts      # 接口（升级为 streaming 版，见 P0-1）
│   ├── http-workbench-client.ts # ★ 真实实现
│   └── mock-workbench-client.ts
└── test/  assets/
```

---

## 第三阶段：代码质量审查

### 3.1 React 层

| # | 问题 | 位置 | 严重度 |
|---|---|---|---|
| R1 | **上帝组件**：10 个组件 + 工具函数挤在 298 行同一文件，`AppShell` 同时管导航/侧栏/聊天/输入/弹窗 | `src/features/AppShell.tsx` 全文件 | P0 |
| R2 | **万能 `set/patch` 后门**：reducer 允许任意覆盖任意字段，action 语义丢失，不可追踪、不可打日志、不可做 optimistic update | `src/app/App.tsx:6-8`、`AppShell.tsx:39,76` | P0 |
| R3 | **全树重渲染**：搜索框每敲一个字 → 根 `dispatch` → 整个 `AppShell`（含全部消息）重渲染；无 `memo`/`useMemo`/`useCallback`（除 1 处） | `App.tsx:25`、`AppShell.tsx:159` | P1 |
| R4 | **Rail 5 个 tab 是死按钮**：无 `onClick`、无选中态切换，`state.section` 全局无人读取 | `AppShell.tsx:144-152`，`RailSection` 类型形同虚设 | P1 |
| R5 | **Composer 无 pending/失败态**：`send()` 无 `try/catch`、无 disabled、无取消；连点两次 = 两条 user 消息 + 覆盖式 mock 回复；失败则 user 消息成孤儿 | `AppShell.tsx:256-266` | P0 |
| R6 | **声明了却从未渲染的能力**：`Message.blocks`、`Message.state('thinking')`、`MessageBlock` 在 UI 层零引用——"Agent 思考中/工具调用/错误"三态全部缺失 | `workbench-client.ts:19` vs `AppShell.tsx:236-251` | P0（产品级） |
| R7 | `ModelSelector` 用 `dispatch(set data)` **全量拷贝 bootstrap** 来换一个 modelId：O(全状态) + 全树刷新 | `AppShell.tsx:290` | P1 |
| R8 | bootstrap `useEffect` 无错误态、无重试、无取消：首屏失败 = 永久 "Loading…" | `App.tsx:26` | P1 |
| R9 | `dialog` 元素手写 `open` 而非 `showModal()`：无焦点陷阱、无 ESC 统一行为（仅 CreateProject 处理了 `onCancel`）、Settings 可被背景交互穿透 | `AppShell.tsx:297`、`CreateProjectDialog.tsx:84` | P1（a11y） |
| R10 | `MessageView` 头像写死 `avatars[0]`：`avatars[Math.max(0, agent ? 0 : 1)]` 恒为 0，且 6 张 prototype 头像 370KB 被无意义打包 | `AppShell.tsx:239` | P2 |

**值得表扬的 React 点**（如实记录）：`aria-pressed`/`role=separator`/`aria-valuenow` 等无障碍属性完整；splitter 同时支持指针拖拽 + 键盘 + 双击重置；`StrictMode` 已开；受控组件写法规范。

### 3.2 TypeScript 层

| # | 问题 | 位置 |
|---|---|---|
| T1 | **贫血领域模型**：全部类型挤在 `workbench-client.ts`（36 行），`id: string` 全局混用——`project.id` 可直接传给 `conversationId`，类型系统零防护。缺 Branded Id（`ProjectId`/`AgentId`/`ConversationId`） | `src/client/workbench-client.ts` |
| T2 | `strict: true` 但缺企业级开关：`noUncheckedIndexedAccess`、`noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`、`exactOptionalPropertyTypes` 均未开 | `tsconfig.json` |
| T3 | `tsconfig.include` 仅 `src`：`e2e/` 与 `scripts/` 不被类型检查——过期 e2e 得以长期潜伏 | `tsconfig.json` |
| T4 | `clone = JSON.parse(JSON.stringify(...))`：丢失 `Date`/`Map`/原型，且每次调用 O(全量状态)；`state.messages` 无界增长后会成为性能与内存黑洞 | `mock-workbench-client.ts:72` |
| T5 | `id: \`mock-${Date.now()}\``：同毫秒两条消息 id 碰撞 → React key 重复 | `mock-workbench-client.ts:77,92` |
| T6 | `as React.CSSProperties` / `as const` / `as Record<string,string>`（webkitdirectory）多处类型体操，掩盖了"缺 design token 类型"和"用非标准 API"的事实 | `AppShell.tsx:140`、`CreateProjectDialog.tsx:123` |

正面：**零 `any` 滥用**（全仓 grep 无命中），`ProjectAvatar` 联合类型设计得当，`WorkbenchClient` 接口抽象方向正确。

### 3.3 CSS / UI 层

| # | 问题 | 位置 |
|---|---|---|
| C1 | **无 Design System**：`styles.css` 是 351 行全局单文件；颜色 `rgba(255,255,255,…)` 硬编码 **60+ 处**，圆角/间距/字号无变量；换肤、品牌定制、白标能力为零 | `src/styles.css` 全文件 |
| C2 | **伪响应式**：`body{min-width:980px;overflow:hidden}` + `.frame{width:1400px;height:900px}` 固定居中——笔记本小屏横向溢出、平板/移动端完全不可用；与"企业工作台"定位直接冲突 | `styles.css:11,15-31` |
| C3 | **仅暗色**：`color-scheme: dark` 写死，无 `prefers-color-scheme`、无 `[data-theme]` 机制；对比度未按 WCAG 校验（多处 `rgba(255,255,255,.38/.46)` 小字） | `index.html:6`、`styles.css` |
| C4 | **性能高危样式**：`.frame backdrop-filter: blur(80px)` + 多层 `blur(30px)` + `saturate(1.4)`，低端机/外接 4K 屏滚动掉帧；`grid-template-columns` transition 触发布局抖动 | `styles.css:31,47,94` |
| C5 | 手写 Switch/Menu/Dialog/Tooltip：与原生语义（`role=switch` 误用 `aria-pressed`，见 `CreateProjectDialog.tsx:137`）和 Phosphor 图标混用，无统一 `shared/ui`  primitives | 全仓 |
| C6 | 中文标点/字号/行高无排版规范（`font-size: 10px/10.5px/11px` 碎片化），`message-bubble` 对代码块/长文本无 `overflow-wrap` 防御 | `styles.css` |

正面：玻璃拟态视觉完成度高；进入/退出 Switcher 的弹簧动画编排细腻；`focus-visible` 全局处理到位。

---

## 第四阶段：AI Agent 产品架构审查

这是本次审计与"普通 Web 应用审查"分野最大的部分。结论先行：**当前前端没有任何一条是为 Agent Runtime 而预留的架构——它是一个"聊天皮肤"，不是"Agent OS 外壳"。**

### 4.1 七项 Agent 能力逐项判定

| 未来能力 | 现状 | 缺口 |
|---|---|---|
| **Agent Runtime（执行态）** | `ProjectExperience` 写死"任务+文件"两段静态列表；`TaskStatus` 只有 queued/running/completed | ❌ 无 `AgentRun/Turn/Step` 模型；无"思考中/工具调用中/等待确认/失败重试"状态机；`Message.state='thinking'` 已定义但 UI 从不渲染 |
| **Tool Calling 可视化** | `ToolMenu` 只是 5 个写死的假按钮，无点击行为 | ❌ 无 `ToolCall{ name, args, status, result, duration }` 模型；无参数折叠/结果渲染/错误展示；无"人工确认 tool call"拦截 UI（企业安全必需） |
| **Reasoning / Streaming** | `sendMessage()` 一元 Promise，回复整包到达 | ❌ 无 SSE/WS 流式通道；无打字机/增量渲染；无 `AbortController` 取消；长推理= UI 长时间"假死" |
| **Workflow** | `template: 'launch'｜'general'` 硬编码二分支，正则 `/发布｜新品/` 猜模板 | ❌ 玩笑级实现（`mock-workbench-client.ts:96`）；无节点/边模型、无画布引擎选型（React Flow 缺席）、无版本/发布语义 |
| **Multi-Agent** | `agents[]` 实为"联系人列表"，`agentId === projectId` 混用 | ❌ 无 Agent Card/Detail/权限/协作关系（handoff、sub-agent）模型 |
| **Memory / Knowledge** | 零。`messages: Record<convId, Message[]>` 全量内存，零分页 | ❌ 无 Personal/Org Memory、无 Knowledge Base、无引用（citation）渲染、无压缩/摘要策略；对话稍长即内存与渲染双爆 |
| **Permission / Enterprise** | 零。`user: { name, initials }` | ❌ 无 Org/Team/Role/RBAC、无鉴权守卫、无审计日志 UI、无 SSO 入口。`RailSection` 的 contacts/files/moments 只是死 tab |

### 4.2 最小可演进的 Agent UI 架构（P2 落地目标，接口先行）

```text
features/agent-timeline/
├── model.ts        # AgentRun { id, agentId, status, steps[] }
│                   # Step = Thinking | ToolCall | ToolResult | UserConfirm | Artifact | Error
├── AgentTimeline.tsx   # 时间线容器（折叠/展开/自动滚动）
├── ThinkingBlock.tsx   # 推理中（shimmer + 取消按钮）
├── ToolCallCard.tsx    # 工具名/参数(JSON折叠)/耗时/状态/结果
├── ConfirmGate.tsx     # ★ 高危工具人工确认（企业安全门）
└── useAgentStream.ts   # ★ 订阅 run 事件流（SSE/WS），替代一元 Promise
```

关键判断：**P0-1（streaming 数据层）不做，第四阶段的一切都是空谈。** 一元 Promise 的 `WorkbenchClient` 是 Agent 化路上的第一块绊脚石。

### 4.3 Workspace 架构判定

当前"Workspace" = 一个 reducer 里的 `conversationId`。缺：

- 路由语义：`/w/:workspaceId/p/:projectId/c/:conversationId`（无路由则无深链接、无刷新保持、无协作分享链接——企业IM/工作台不可接受）；
- Project ≠ Conversation ≠ Agent 三者关系混乱：`project.agentId === project.id`（`mock-workbench-client.ts:98`），`conversation.agentId` 又指向同一 id——三权合一，后续"一个项目多 Agent/多会话"必炸；
- 无 Files/Tasks 全局视图（Rail 的 files tab 是死的）。

---

## 第五阶段：性能审查

### 5.1 实测数据（`npm run build`，Vite 默认配置）

| 指标 | 实测 | 企业基线 | 判定 |
|---|---|---|---|
| `dist/` 总体积 | **33MB** | < 3MB（首屏） | 🔴 灾难：20 张 `DIM_STAR_*.png` 每张 1.4~2.0MB |
| 首屏实际需要的头像 | 1~2 张（~38px 展示） | 按需加载 | 🔴 其余 18 张被 `index.ts` 静态 import 强制打包 |
| JS 单包 | 276KB（gzip 104KB） | 可接受 | 🟡 但零分包：改 1 行 CSS 也让用户重下 276KB |
| CSS | 32KB（gzip 6.6KB） | 好 | 🟢 |
| Lazy/Code Splitting | **0 处** `React.lazy`，单 chunk | 路由/弹窗级懒加载 | 🔴 |
| 首屏 JS 并发 | 全量同步 | 关键路径 < 170KB | 🟡 |

### 5.2 P0/P1/P2 性能清单

**P0（立即修，单日可完成）：**

- **P0-PERF-1 · 32MB 头像全量打包**：`src/assets/project-avatars/index.ts` 20 个静态 `import` → 改为**动态 `import()` + 首屏仅预加载 1 张**，并将 PNG 转 WebP/AVIF（38px 展示用 1.7MB 原图是 100 倍浪费）。预期收益：`dist` 33MB → <1MB，LCP 提升数秒。
  - 顺带：`avatar-1..6.png`（370KB）仅 `MessageView` 用了第 0 张，其余 5 张是死资源——删或懒加载。

**P1（本迭代）：**

- **P1-PERF-1 · 弹窗级懒加载**：`CreateProjectDialog` / `SettingsDialog` 改 `React.lazy + Suspense`（当前被同步打进主包）；
- **P1-PERF-2 · 根 reducer 全树刷新**：搜索输入/侧栏拖拽（`pointermove` 高频 `dispatch`）每次全量渲染；拆分 `useReducer` 为 server-state（bootstrap）+ ui-state，或引入 TanStack Query + zustand；`ContactRow`/`MessageView` 加 `memo`；
- **P1-PERF-3 · JSON 深拷贝**：`mock-workbench-client.ts:72` 每次调用全量 clone——`messages` 增长后单次 `sendMessage` 可达数十 ms 主线程阻塞；换 `structuredClone`（过渡）→ 后续归一化 store（终态）；
- **P1-PERF-4 · `backdrop-filter: blur(80px)`**：大面积高斯模糊是低端机杀手；增加 `@media (prefers-reduced-motion)` 降级与低端设备开关；
- **P1-PERF-5 · Vite 分包**：`build.rollupOptions.output.manualChunks` 拆 `react-vendor` / `icons`，并开启 `assetsInlineLimit` 审查（小 SVG 应内联、大 PNG 绝不内联）。

**P2（90 天）：**

- **P2-PERF-1**：消息列表虚拟化（`@tanstack/virtual`），`messages` 分页 + 归一化（`byId` + `ids`），`Record<string, Message[]>` 全量结构退役；
- **P2-PERF-2**：图片 CDN 化 + `srcset` + `loading="lazy"`；头像走对象存储而非打包产物；
- **P2-PERF-3**：引入性能预算 CI（`bundlesize` / Lighthouse CI），`dist` 超 3MB 即红灯。

---

## 第六阶段：安全审查

> 前提：当前是纯 Mock、无后端、无鉴权，所以是"结构性风险审计"——即**今天不修、接后端那天就会爆炸**的问题。

| # | 风险 | 位置 | 说明与修复 |
|---|---|---|---|
| S1 | **头像上传零校验 → 内存炸弹** | `CreateProjectDialog.tsx:52-59` | `chooseAvatar` 未校验 `file.type/size`；`accept="image/*"` 可被绕过；`FileReader.readAsDataURL` 把任意大小文件（可 500MB）塞进 React state，再被 reducer + JSON clone 放大。修复：白名单 `['image/png','image/jpeg','image/webp']` + `size ≤ 2MB` + 超限错误提示（P0） |
| S2 | **无认证/鉴权层** | 全仓 | `user` 只有名字缩写；无 token 存储/刷新/过期策略，无路由守卫。接后端前必须定案：httpOnly cookie + refresh rotation，**Token 永不进 `localStorage`**（P0 设计项） |
| S3 | **XSS 基础好但无护栏** | 全仓 | 当前无 `dangerouslySetInnerHTML`（✅ 好）。但未来渲染 Agent 返回的 Markdown/HTML/artifact 预览时必然引入风险——**现在就把 `DOMPurify + 白名单` 写进 `shared/ui/Markdown.tsx` 规范**，而不是事后补（P1） |
| S4 | **缺 CSP / 安全头** | `index.html`、无服务器配置 | 无 `Content-Security-Policy`、无 `X-Content-Type-Options`；`dataUrl` 头像 + 未来外链预览需要 `img-src data:` 最小化策略（P1，随部署方案落地） |
| S5 | **敏感数据裸奔设计** | `workbench-client.ts:19-22` | `AttachmentRef` 只有展示字段，无上传凭证/签名 URL/过期语义；`workingFolder.mockRef: 'browser-folder:xxx'` 是伪造式路径——真实实现必须走预签名上传 + 服务端病毒扫描，附件绝不经前端 state 中转大文件（P1 设计项） |
| S6 | **CSRF 预留** | — | 当前无 cookie故无 CSRF；一旦用 cookie 会话，必须 SameSite=Lax/Strict + 服务端 CSRF token（P2 设计项，记录在案） |
| S7 | **信息泄露面** | `mock-workbench-client.ts` | Mock 文案直写"未调用真实模型/Kernel"——上线前必须有 `import.meta.env` 环境隔离，Mock client 禁止打进生产包（`vite.config` + `main.tsx` 按 `MODE` 切换，P0） |
| S8 | **非标准 API 风险** | `CreateProjectDialog.tsx:123` | `webkitdirectory` 非标准、Firefox/Safari 行为不一；拖拽 `webkitGetAsEntry` 同理。企业级需 File System Access API 渐进增强 + 降级提示（P2） |

---

## 第七阶段：工程化审查

| 企业标准 | 现状 | 判定 |
|---|---|---|
| ESLint | **无**（`package.json` 无 eslint 依赖） | ❌ P0：`features/` 依赖规则、未使用变量、a11y（`jsx-a11y`）全部裸奔 |
| Prettier / EditorConfig | **无** | ❌ P0：当前单行超长 JSX（如 `AppShell.tsx:140`）无人约束 |
| Husky + lint-staged | **无** | ❌ P0 |
| CI/CD | **无 `.github/`**，无构建/测试/预览流水线 | ❌ P0 |
| 自动测试 | Vitest 11 用例全过 ✅，但 e2e **已部分腐烂**：`rail-sidebar.spec.ts` 找不存在的「新建」按钮/`menuitem`；`visual-source.spec.ts` 点不存在的「收起侧边栏」；`glass-layer.spec.ts` 断言 rail 55px 而 CSS 是 60px；且截图写到仓库外的 `../../../visual-review/`（CI 必炸） | ⚠️ P1 |
| e2e 服务方式 | `webServer.command: 'npm run dev'`（dev server 跑 e2e，又慢又不稳定） | ⚠️ P1：改 `vite preview` + `npm run build` 前置 |
| Git 规范 | 仅 1 个 commit（`chore: ignore...`），无 CONTRIBUTING/Commitlint | ⚠️ P1 |
| Environment 管理 | 无 `.env*`、无 `.env.example`；Mock/真实 client 在 `main.tsx` 硬编码切换 | ❌ P0 |
| Node 版本锁定 | 无 `.nvmrc` / `engines`（`package-lock` 有但无声明） | ⚠️ P1 |
| 路径别名 | 无（`../client/...` 相对路径，最深 2 层尚可，但 features 拆分后必乱） | ⚠️ P1：加 `@/` alias |
| 测试覆盖率门禁 | 无（`vitest --coverage` 未配置） | ⚠️ P2 |

**最小可用工程化补齐包（P0，一天工作量）**：`eslint + typescript-eslint + jsx-a11y + prettier + husky + lint-staged`，`.github/workflows/ci.yml`（install → typecheck → lint → unit → build → playwright preview），`.nvmrc` + `engines`，`.env.example`（`VITE_API_MODE=mock|http`、`VITE_API_BASE_URL`）。

---

## 第八阶段：与顶级 AI 产品比较

### 8.1 差距矩阵

| 能力 | ChatGPT Workspace / Claude Enterprise | Cursor | Copilot (M365) | **本项目** |
|---|---|---|---|---|
| 流式生成 + 取消/重试 | ✅ 标配 | ✅ | ✅ | ❌ 整包到达，无取消 |
| 推理/工具调用可视化 | ✅ thinking + tool timeline | ✅ 文件级 diff 过程 | ✅ 引用溯源 | ❌ 类型已定义、UI 零渲染 |
| Artifact / 产物面板 | ✅ Canvas/Artifacts 侧栏 | ✅ Composer 多文件 | ✅ Pages | ⚠️ 静态两段列表 |
| 命令面板 / 快捷键 | ✅ Cmd+K 全局 | ✅ Cmd+K/L | ✅ | ❌ |
| 深链接/分享/协作 | ✅ 会话链接、多人 | ✅ | ✅ 组织级 | ❌ 无路由 |
| 知识库/记忆/引用 | ✅ GPTs 知识、Claude Projects | ✅ Codebase 索引 | ✅ Graph 接入 | ❌ |
| 模型切换/多模型 | ✅ | ✅ 多模型并行 | ✅ | ⚠️ 9 个假模型（纯展示） |
| 组织/权限/审计/SSO | ✅ 企业三件套 | ✅ Team 版 | ✅ Entra ID | ❌ |
| 主题/无障碍/国际化 | ✅ | ✅ | ✅ | ⚠️ 仅暗色、a11y 半成品、无 i18n |
| 离线/性能/虚拟化 | ✅ 长会话虚拟化 | ✅ 大文件 | ✅ | ❌ 全量内存渲染 |
| **视觉差异化** | 通用 SaaS 风 | IDE 风 | M365 风 | ✅ **玻璃拟态 + Agent Switcher 切换动效是真实差异化** |

### 8.2 优势（真实的，不是安慰）

1. **视觉语言有记忆点**：玻璃拟态 + 项目头像星球体系 + Switcher 弹簧编排，是"AI 工作台"品类里少见的高完成度视觉原型——这是继续投入的理由，不是重写的理由。
2. **`WorkbenchClient` 端口-适配器雏形**：前后端解耦意识早于 90% 的 Phase 0 项目，只要把接口升级为 streaming 版（P0-1），Mock→真实是一条直线。
3. **测试意识**：Phase 0 就有 11 个单测 + 5 个 e2e spec + 无障碍断言（`aria-pressed` 等），起点高于多数原型。

### 8.3 不足与缺失模块（Top 10，按企业采购视角排序）

1. 缺 RBAC/组织/SSO/审计——**进不了企业采购名单**；
2. 缺流式Agent执行可视化——**不是 Agent 产品**；
3. 缺路由/深链接——协作分享链路断裂；
4. 缺知识库/记忆/引用——留存与壁垒模块缺席；
5. 缺命令面板/快捷键体系——重度用户效率天花板；
6. 缺 Design System——多团队并行开发会视觉分裂；
7. 缺 i18n——出海与外企客户一票否决；
8. 缺 E2E 可靠性（spec 已腐烂）——回归信心为零；
9. 缺移动端/响应式——管理者场景（手机审批）缺席；
10. 缺可观测性（前端日志/埋点/错误上报 Sentry）——线上盲飞。

---

## 第九阶段：最终报告

### 9.1 当前完成度评分

**Frontend 成熟度：32 / 100**（企业级 AI 工作台标尺；若按"Phase 0 视觉原型"标尺约为 68/100）

| 维度 | 得分 | 一句话 |
|---|---|---|
| 技术栈选型 | 55 | 现代但极简，缺 6 个企业必备件（路由/请求/校验/i18n/UI/状态） |
| 目录架构 | 30 | 有名无实的 features，上帝组件 + 泥球 reducer |
| React 实践 | 42 | a11y 细节好，状态与渲染策略差 |
| TypeScript | 50 | 零 any 是亮点，领域建模是短板 |
| Design System / CSS | 30 | 视觉 85 分，系统 10 分；固定 1400×900 是硬伤 |
| AI 产品架构 | 20 | 聊天皮肤，非 Agent 外壳 |
| 性能 | 25 | 33MB 产物，首屏背 32MB 无用图片 |
| 安全 | 40 | 现无后端故风险未爆，但 8 项结构债已就位 |
| 工程化 | 20 | 三无：无 lint、无 hooks、无 CI |
| 测试 | 55 | 单测健康，e2e 腐烂中 |

### 9.2 架构评价

**优秀点：**

- E1：`WorkbenchClient` 接口隔离（`src/client/workbench-client.ts`）——端口-适配器思想正确，是全仓最重要的架构资产；
- E2：无障碍起点高——`role/aria-*` 覆盖完整，splitter 三模操作（指针/键盘/双击）；
- E3：测试金字塔已搭架——Vitest + Playwright + 几何校验脚本，Phase 0 少见；
- E4：视觉与动效完成度——玻璃拟态 + Switcher 编排具备产品差异化潜力。

**问题：**

- A1：`AppShell.tsx` 上帝组件 + `App.tsx` 万能 patch reducer——状态与视图双泥球；
- A2：一元 Promise 数据层——与 Agent streaming 范式根本冲突；
- A3：`ProjectAvatar` 20 张原图静态打包——33MB 产物事故；
- A4：零路由、零鉴权、零 Design System、零工程化护栏——四个"零"任一个都会在接后端/扩团队时爆雷。

**风险：**

- 🔴 RISK-1：若在现有结构上直接堆 Agent/Memory/Workflow，2 个月内 `AppShell` 膨胀至不可维护，重构成本指数上升——**必须先做 P0 结构手术**；
- 🔴 RISK-2：`messages` 全量内存 + JSON clone + 无虚拟化——真实长会话首日即卡死；
- 🟡 RISK-3：e2e 腐烂（过期 selector + 仓外截图路径）——CI 一上就红，团队对测试失去信任；
- 🟡 RISK-4：固定 1400×900 + min-width 980px——第一个"支持 13 寸笔记本/平板"的需求就会推翻布局假设。

### 9.3 必须修改（P0）—— 不做不准进下一阶段

| ID | 事项 | 具体文件与修改方案 | 工作量 |
|---|---|---|---|
| P0-1 | **数据层升级为 streaming  capable** | `src/client/workbench-client.ts`：新增 `sendMessageStream(input, signal): AsyncIterable<AgentEvent>`，其中 `AgentEvent = TextDelta｜Thinking｜ToolCall｜ToolResult｜ArtifactDelta｜Done｜Error`；`Mock` 用定时器吐 delta 模拟流；`Composer` 消费流做增量渲染 + `AbortController` 取消。这是全部 Agent 化的前置 | 3~5 天 |
| P0-2 | **拆上帝组件 + 杀万能 patch** | `src/features/AppShell.tsx` → 按 §2.3 拆为 `rail-nav/sidebar/conversation/composer/project/model-selector` 六个 feature 目录；`src/app/App.tsx` 删除 `{type:'set',patch}`，改为显式 action（`selectConversation/openDialog/resizeSidebar/...`）；server state 与 ui state 分两个 reducer | 3~5 天 |
| P0-3 | **32MB 图片事故** | `src/assets/project-avatars/index.ts`：20 个静态 import → `new URL(..., import.meta.url)` 懒加载/`import()`；PNG→WebP（38px 展示）；删 `MessageView` 未用的 5 张 prototype 头像。验收：`dist/` < 1.5MB（不含按需图） | 1 天 |
| P0-4 | **工程化三件套 + CI** | 新增 ESLint（`typescript-eslint`+`jsx-a11y`+`import` 依赖规则）/ Prettier / Husky+lint-staged / `.github/workflows/ci.yml`（typecheck+lint+test+build+e2e preview）/ `.nvmrc`+`engines` / `.env.example` | 1~2 天 |
| P0-5 | **Composer 发送状态机** | `AppShell.tsx:256-266`（拆后位于 `features/composer/`）：pending 禁发 + 失败重试 + 错误横幅 + 取消按钮；`createProject` 同理（`App.tsx:29` 透传错误到 Dialog 内展示） | 1 天 |
| P0-6 | **头像上传校验** | `CreateProjectDialog.tsx:52-59`：白名单 mime + `≤2MB` + 错误提示；`main.tsx` 按 `import.meta.env.VITE_API_MODE` 切换 Mock/HTTP，Mock 禁止进生产包 | 0.5 天 |
| P0-7 | **tsconfig 企业级收紧** | `tsconfig.json` 加 `noUncheckedIndexedAccess/noUnusedLocals/noUnusedParameters/verbatimModuleSyntax`，`include` 扩大到 `e2e,scripts`（或单建 `tsconfig.e2e.json`），修爆出的存量错误 | 0.5 天 |

### 9.4 建议优化（P1）—— 60 天内完成

| ID | 事项 | 具体文件与修改方案 |
|---|---|---|
| P1-1 | 引入路由 | 新增 `react-router` + `src/app/router.tsx`：`/w/:workspaceId/p/:projectId/c/:conversationId`；`conversationId` 从 reducer 迁到 URL；刷新保持 + 可分享链接 |
| P1-2 | 服务端状态归一化 | 引入 TanStack Query（bootstrap/send/project），`messages` 改 `byId+ids`，`Record<string,Message[]>` 退役；`ModelSelector` 不再全量拷贝（修 `AppShell.tsx:290` 模式） |
| P1-3 | Design Token 第一版 | 新增 `src/shared/styles/tokens.css`（颜色/圆角/间距/字号/阴影/动效 6 组变量）+ `[data-theme]` 暗/亮双主题；`styles.css` 硬编码逐批迁移；Switch/Menu/Dialog 收敛到 `shared/ui` |
| P1-4 | 修复腐烂 e2e | `e2e/rail-sidebar.spec.ts`（「新建」按钮不存在）、`visual-source.spec.ts`（「收起侧边栏」不存在）、`glass-layer.spec.ts`（55px vs 60px）三处过期断言；截图路径收敛到 `test-results/`；`playwright.config.ts` 改 `vite preview` |
| P1-5 | 响应式第一刀 | 去掉 `min-width:980px`，`.frame` 固定 1400×900 → `min(1400px, 100vw)` 流式 + 断点（<1100px 侧栏 overlay 化）；补 `prefers-reduced-motion` |
| P1-6 | XSS/Markdown 预案 | 新增 `shared/ui/Markdown.tsx`（`react-markdown` + `DOMPurify` 白名单 + 代码高亮），`MessageView` 的 `blocks: code/artifact/error` 首次真实渲染—— filling R6 的坑 |
| P1-7 | 路径别名 + 依赖规则 | `tsconfig.paths` + `vite.resolve.alias` 配 `@/`；ESLint `no-restricted-imports` 强制 `features/*` 互不直引、只能经 `entities/shared` |
| P1-8 | 状态渲染性能 | `ContactRow/MessageView` memo 化；splitter `pointermove` 节流（rAF）；Vite `manualChunks` 拆 vendor；Dialog `React.lazy` |
| P1-9 | 可观测性起步 | 错误边界（`app/ErrorBoundary.tsx`）+ Sentry（或自研上报）+ 关键埋点（发送/创建/切换模型） |
| P1-10 | 文档与规范 | `docs/ARCHITECTURE.md`（目录/依赖规则）+ `docs/API_CONTRACT.md`（WorkbenchClient 事件契约）+ Commitlint（conventional commits） |

### 9.5 长期演进（P2）—— 90 天及以后

| ID | 事项 |
|---|---|
| P2-1 | Agent Timeline 完整体：Thinking/ToolCall/ConfirmGate/Artifact 时间线 + 人工确认安全门（见 §4.2） |
| P2-2 | 鉴权与企业三件套：OIDC/SSO 登录、Org/Team/RBAC 模型、路由守卫、审计日志 UI |
| P2-3 | Workspace 深水区：Project Detail 页、Files/Tasks 全局视图、Knowledge Base、Memory（Personal/Org）面板 |
| P2-4 | Workflow 引擎：节点/边模型 + React Flow 画布 + 版本/发布 + 运行历史 |
| P2-5 | 消息虚拟化 + 分页 + 离线草稿（IndexedDB）+ 乐观更新 |
| P2-6 | 命令面板（Cmd+K）+ 全局快捷键体系 + 无障碍 WCAG 2.2 AA 达标 |
| P2-7 | i18n（`react-i18next`，中/英）+ 白标主题（CSS 变量换肤 + Logo 插槽） |
| P2-8 | 性能预算 CI（Lighthouse CI + bundlesize）+ 图片 CDN + WebP/AVIF 全量 + PWA（可选） |
| P2-9 | 微前端/模块联邦预研（仅当"Plugin 系统"确认为平台战略时启动，否则保持单体） |
| P2-10 | Storybook（Design System 文档化）+ 视觉回归（Chromatic/Playwright screenshots）替代手写几何脚本 |

### 9.6 下一阶段开发路线

**30 天（止血 + 结构手术）——目标： maturity 32 → 50，达到"可接后端"状态**

- Week 1：P0-4（工程化+CI）→ P0-7（tsconfig）→ P0-3（图片事故，当天见效）；立 `docs/ARCHITECTURE.md`
- Week 2：P0-2（拆 AppShell + 显式 action）→ P1-7（别名+依赖规则，用 ESLint 锁死新结构）
- Week 3：P0-1（streaming 数据层 + Mock 流 + Composer 增量渲染/取消）→ P0-5（发送状态机）→ P1-6（Markdown/blocks 首渲染）
- Week 4：P0-6（上传校验+env 隔离）→ P1-4（修 e2e + preview）→ 缓冲：补单测到核心链路（发送/创建/切换）

**60 天（企业地基）——目标：50 → 65，达到"可内测"状态**

- P1-1 路由深链接 → P1-2 TanStack Query 归一化 → P1-8 渲染性能 → P1-3 Token+亮色主题 → P1-5 响应式 → P1-9 错误边界+Sentry → P1-10 契约文档
- 里程碑验收：13 寸屏可用、亮/暗双主题、会话可分享链接、长会话不卡、CI 全绿

**90 天（Agent 化）——目标：65 → 78，达到"可对外演示企业版"状态**

- P2-1 Agent Timeline（含 ConfirmGate）→ P2-3 Project Detail + Files/Tasks 视图 → P2-6 Cmd+K → P2-5 虚拟化 → P2-2 SSO/RBAC 第一版 → P2-7 i18n
- 里程碑验收：完整 Agent 执行可视化 Demo（含工具调用+人工确认）、Org 内测、双语切换

---

### 附：审计师签字意见

> 这个仓库最危险的不是 32 分的现状——Phase 0 得 32 分很正常。最危险的是**它"看起来完成了"**：视觉精美、测试全绿、构建通过，容易让团队误判为"地基已打好，可以往上盖"。真相是：承重墙（streaming 数据层、路由、状态结构）一根没立，往上每盖一层，返工成本翻一番。
>
> 好消息：地基返工只需约 3 周（P0 清单），且 `WorkbenchClient` 抽象和测试习惯是对的种子。建议：**冻结新功能 3 周，先做 P0，再谈 Agent。**

*—— Principal Frontend Architect，2026-09-10*
