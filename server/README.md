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
| POST | `/api/projects/:id/chat` | 访谈对话,Body `{"text":"..."}`；答满5题自动生成档案+计划,返回 `{reply,done,project}` |

访谈剧本见 `server/interview.js`(任务5换成真 AI,接口不变)。

## 对话阶段

`consulting`(自由咨询,只答不做) → `collecting`(需求收集,5问)
→ `confirming`(展示方案,必须明确确认) → `executing`(分3步执行)
↔ `paused`(暂停) → `done`(完成)。

- 确认关键词:确认/好的/开始/可以…；纠错格式:“价格改成199元”；暂停/继续随时可用。
- 阶段存 `projects.phase`,纠错覆盖存 `overrides_json`,刷新/重启不丢。

## 测试

```bash
npm run test:server   # Node 自带测试运行器,不需要装依赖
```

## 数据

SQLite 数据库文件:`server/data/app.db`(自动创建,已加入 `.gitignore`,不提交到仓库)。
服务重启后文件还在,数据就不丢。
