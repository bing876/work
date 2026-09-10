# dimspace-server(任务1:最小后端)

零第三方依赖,只用 Node 自带模块(`node:http` + `node:sqlite`)。

## 启动

```bash
node server/index.mjs
# 或:PORT=3001 node server/index.mjs
# 或:npm run server
```

## 接口(共 8 个)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查,返回 `{"ok":true,...}` |
| POST | `/api/auth/code` | 发验证码,Body `{"phone":"..."}`；开发阶段固定返回 123456(短信商预留) |
| POST | `/api/auth/login-phone` | 手机+验证码登录,Body `{"phone","code"}`；未注册自动注册(随机配 5 位起 XYZ 坐标号,坐标号即登录密码)；返回 `{token,registered,user}` |
| POST | `/api/auth/login-account` | 账号登录,Body `{"phone","coordinateId"}`(手机号=账号,坐标号=密码,大小写不敏感)；未注册/号不对各有明确 401 |
| GET | `/api/auth/me` | (需登录)当前身份 |
| GET | `/api/meta` | (需登录)服务信息 `{model,modelConfigured}`；前端模型角标唯一真相来源 |
| GET | `/api/projects` | 项目列表(含 `profile`/`plan`,未生成为 `null`) |
| POST | `/api/projects` | 创建项目,Body `{"name":"xxx","initialMessage":"..."}`(后者可选,视为访谈第1个回答)；自动写入 AI 开场白,返回 `messages` |
| GET | `/api/projects/:id` | 单个项目 |
| PUT | `/api/projects/:id` | 保存商品资料(任务4改档案复用),Body `{"profile":{6个字符串字段,单个最多2000字}}` |
| GET | `/api/projects/:id/messages` | 全部消息(老项目自动补开场白) |
| GET/PUT | `/api/projects/:id/consensus` | 项目记忆(事实/决定/历史)；PUT 只支持 `{op:'correct',id,text}` 纠正 |
| GET | `/api/projects/:id/summary` | 记忆摘要：记住什么 + 哪些可能不准(前端快捷键入口后续加) |
| GET | `/api/projects/:id/tasks` | 任务方案列表(步骤4确认门) |
| POST | `/api/projects/:id/tasks` | 建方案,Body `{"title":"...","detail":"..."}`(后者可选)；返回 `status=proposed,proposalVersion=1` |
| PUT | `/api/projects/:id/tasks/:taskId` | 修订方案(仅 proposed 可改,版本号+1)；已确认改→409 |
| POST | `/api/projects/:id/tasks/:taskId/confirm` | 显式确认,Body `{"proposalVersion":整数}`；版本过期→409(含 `currentVersion`)；重复确认→200幂等 |
| POST | `/api/projects/:id/tasks/:taskId/cancel` | 取消方案(proposed/confirmed 均可,已取消再取幂等) |
| POST | `/api/projects/:id/chat` | AI 对话,Body `{"text":"..."}`；返回 `{mode,reply,done,project}`；模型失败时明确报错+可重试(503 未配置/429 超预算/504 超时/502 调用失败) |

### 鉴权与隔离
- 除 `/health` 和 `/api/auth/code|login-phone|login-id` 外,所有业务接口需请求头 `Authorization: Bearer <token>`(JWT,HS256,30天有效)；无 Token/过期/伪造一律 401。
- 数据按 `projects.user_id` 隔离:跨用户访问一律 401/404,看不到对方任何数据；无主老数据(升级前)不对任何用户可见。
- `AUTH_SECRET` 未设置时每进程随机生成(重启后旧 Token 失效)；生产/Render 请在 Environment 里固定填写。

### 交互决策(步骤4验收时确定,步骤5起执行)
- 确认交互只走自然语言对话,不做确认按钮/任务卡片 UI:用户说确认类→模型发【确认】块→后端 `confirmTask`;说算了→【取消】;说调整→【修订】;需新方案→【提议】。
- 后端 `taskId + proposalVersion + 幂等` 保留作安全保障;待确认清单注入 system prompt 供模型对编号;动作块一律剥离不显示,确认/修订失败才追加一句系统提示。

提示词见 `server/prompts.js`,行业模板见 `server/templates/`,后端硬规则见 `server/policy.js`。

## 模型配置

OpenAI-compatible 接口,默认 DeepSeek。环境变量(见 `.env.example`):

| 变量 | 说明 |
|---|---|
| `MODEL_API_KEY` | 密钥,只放环境变量或 `.env`(已忽略,不提交);缺失时聊天明确报错"模型未配置" |
| `MODEL_BASE_URL` | 默认 `https://api.deepseek.com` |
| `MODEL_NAME` | 默认 `deepseek-chat` |
| `MODEL_TIMEOUT_MS` | 单次超时,默认 60000;超时明确报错,可重试(不自动重试) |
| `MODEL_BUDGET_TOKENS` | 累计 token 上限,0=不限;超限即拦。每次用量记 `model_usage` 表 |

## 测试

```bash
npm run test:server   # Node 自带测试运行器,不需要装依赖
```

## 数据

SQLite 数据库文件:`server/data/app.db`(自动创建,已加入 `.gitignore`,不提交到仓库)。
服务重启后文件还在,数据就不丢。
