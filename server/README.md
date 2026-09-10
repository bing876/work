# dimspace-server(任务1:最小后端)

零第三方依赖,只用 Node 自带模块(`node:http` + `node:sqlite`)。

## 启动

```bash
node server/index.mjs
# 或:PORT=3001 node server/index.mjs
# 或:npm run server
```

## 接口(共 4 个)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查,返回 `{"ok":true,...}` |
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目,Body `{"name":"xxx"}` |
| GET | `/api/projects/:id` | 单个项目 |

## 数据

SQLite 数据库文件:`server/data/app.db`(自动创建,已加入 `.gitignore`,不提交到仓库)。
服务重启后文件还在,数据就不丢。
