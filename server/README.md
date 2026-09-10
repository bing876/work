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
| GET | `/api/projects` | 项目列表(含 `profile`/`plan`,未生成为 `null`) |
| POST | `/api/projects` | 创建项目,Body `{"name":"xxx","initialMessage":"..."}`(后者可选,视为访谈第1个回答)；自动写入 AI 开场白,返回 `messages` |
| GET | `/api/projects/:id` | 单个项目 |
| PUT | `/api/projects/:id` | 保存商品资料(任务4改档案复用),Body `{"profile":{6个字符串字段,单个最多2000字}}` |
| GET | `/api/projects/:id/messages` | 全部消息(老项目自动补开场白) |
| GET/PUT | `/api/projects/:id/consensus` | 项目记忆(事实/决定/历史)；PUT 只支持 `{op:'correct',id,text}` 纠正 |
| GET | `/api/projects/:id/summary` | 记忆摘要：记住什么 + 哪些可能不准(前端快捷键入口后续加) |
| POST | `/api/projects/:id/chat` | AI 对话,Body `{"text":"..."}`；返回 `{mode,reply,done,project}`；模型失败时明确报错+可重试(503 未配置/429 超预算/504 超时/502 调用失败) |

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
