// 任务1:最小后端 + SQLite 文件数据库(零第三方依赖,只用 Node 自带模块)
// 接口只有 5 个:
//   GET  /health             健康检查
//   GET  /api/projects       项目列表
//   POST /api/projects       创建项目,Body: {"name": "xxx"}
//   GET  /api/projects/:id   单个项目详情
//   PUT  /api/projects/:id   保存商品资料,Body: {"profile": {"productName": "...", ...}}(任务3新增)
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENING } from './interview.js';
import { honestReply } from './policy.js';
import { TRANSITION_MODE, transitionReply } from './transition.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
// 测试可用 DB_FILE 指向临时库,避免污染真实数据
const dbPath = process.env.DB_FILE ?? join(rootDir, 'data', 'app.db');
mkdirSync(dirname(dbPath), { recursive: true });

// SQLite 数据库就是一个本地文件,服务重启后文件还在,数据就不丢
const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
// 老库迁移:任务1建的表没有 profile_json 列,自动补上,老数据不受影响
const hasProfileColumn = db
  .prepare('PRAGMA table_info(projects)')
  .all()
  .some((column) => column.name === 'profile_json');
if (!hasProfileColumn) db.exec('ALTER TABLE projects ADD COLUMN profile_json TEXT');
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
const hasPlanColumn = db
  .prepare('PRAGMA table_info(projects)')
  .all()
  .some((column) => column.name === 'plan_text');
if (!hasPlanColumn) db.exec('ALTER TABLE projects ADD COLUMN plan_text TEXT');
const hasDraftColumn = db
  .prepare('PRAGMA table_info(projects)')
  .all()
  .some((column) => column.name === 'draft_text');
if (!hasDraftColumn) db.exec('ALTER TABLE projects ADD COLUMN draft_text TEXT');
for (const [column, ddl] of [['phase', 'ALTER TABLE projects ADD COLUMN phase TEXT'], ['overrides_json', 'ALTER TABLE projects ADD COLUMN overrides_json TEXT']]) {
  const exists = db.prepare('PRAGMA table_info(projects)').all().some((c) => c.name === column);
  if (!exists) db.exec(ddl);
}
// 老数据回填阶段:有档案=已完成,否则回到自由咨询
db.exec("UPDATE projects SET phase = CASE WHEN profile_json IS NOT NULL THEN 'done' ELSE 'consulting' END WHERE phase IS NULL");

const PROFILE_KEYS = ['productName', 'category', 'price', 'specs', 'sellingPoints', 'notes'];
// 只收白名单里的6个字段,必须是字符串、每个最多2000字,多余的一律丢掉
const normalizeProfile = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('profile 必须是对象');
  const profile = {};
  for (const key of PROFILE_KEYS) {
    const field = value[key] ?? '';
    if (typeof field !== 'string') throw new Error(`profile.${key} 必须是字符串`);
    if (field.length > 2000) throw new Error(`profile.${key} 最多2000字`);
    profile[key] = field;
  }
  return profile;
};
const toProjectJson = (row) => ({
  id: row.id,
  name: row.name,
  created_at: row.created_at,
  profile: row.profile_json ? JSON.parse(row.profile_json) : null,
  plan: row.plan_text ?? null,
  draft: row.draft_text ?? null,
  phase: row.phase ?? 'consulting',
});
const toMessageJson = (row) => ({ id: row.id, author: row.author, text: row.text, created_at: row.created_at });
const insertMessage = (projectId, author, text) =>
  db.prepare('INSERT INTO messages (project_id, author, text, created_at) VALUES (?, ?, ?, ?)').run(projectId, author, text, now());
const readMessages = (projectId) =>
  db.prepare('SELECT id, author, text, created_at FROM messages WHERE project_id = ? ORDER BY id').all(projectId).map(toMessageJson);
// 老项目没有开场白,首次读取时自动补一条
const readMessagesWithOpening = (projectId) => {
  let messages = readMessages(projectId);
  if (messages.length === 0) {
    insertMessage(projectId, 'assistant', OPENING);
    messages = readMessages(projectId);
  }
  return messages;
};

const now = () => new Date().toISOString();
const send = (res, status, obj) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*', // 允许浏览器预览和以后前端调用
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (chunk) => {
      text += chunk;
      if (text.length > 1024 * 1024) reject(new Error('body too large')); // 1MB 上限,防刷
    });
    req.on('end', () => resolve(text));
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, { ok: true });
    const url = new URL(req.url ?? '/', 'http://localhost');

    // 1) 健康检查:浏览器打开能看到 {"ok":true} 就说明服务活着
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'dimspace-server', time: now() });
    }

    // 2) 项目列表
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      const rows = db.prepare('SELECT id, name, created_at, profile_json, plan_text, draft_text, phase, overrides_json FROM projects ORDER BY id').all();
      return send(res, 200, { ok: true, count: rows.length, projects: rows.map(toProjectJson) });
    }

    // 3) 创建项目:自动写入 AI 开场白;如果带了第一句话,存档为用户原话并给过渡回复
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return send(res, 400, { ok: false, error: 'name 不能为空' });
      if (name.length > 100) return send(res, 400, { ok: false, error: 'name 最多100个字' });
      const initial = typeof body.initialMessage === 'string' ? body.initialMessage.trim().slice(0, 2000) : '';
      const result = db
        .prepare('INSERT INTO projects (name, created_at, phase) VALUES (?, ?, ?)')
        .run(name, now(), 'consulting');
      const id = Number(result.lastInsertRowid);
      insertMessage(id, 'assistant', OPENING);
      if (initial) {
        insertMessage(id, 'user', initial);
        insertMessage(id, 'assistant', honestReply(transitionReply(initial)));
      }
      const row = db
        .prepare('SELECT id, name, created_at, profile_json, plan_text, draft_text, phase, overrides_json FROM projects WHERE id = ?')
        .get(id);
      return send(res, 201, { ok: true, project: toProjectJson(row), messages: readMessages(id) });
    }

    // 4) 单个项目
    const single = url.pathname.match(/^\/api\/projects\/(\d+)$/);
    if (req.method === 'GET' && single) {
      const row = db
        .prepare('SELECT id, name, created_at, profile_json, plan_text, draft_text, phase, overrides_json FROM projects WHERE id = ?')
        .get(Number(single[1]));
      if (!row) return send(res, 404, { ok: false, error: '项目不存在' });
      return send(res, 200, { ok: true, project: toProjectJson(row) });
    }

    // 5) 保存商品资料(任务3新增)
    if (req.method === 'PUT' && single) {
      const id = Number(single[1]);
      const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
      if (!exists) return send(res, 404, { ok: false, error: '项目不存在' });
      let profile;
      try {
        profile = normalizeProfile(JSON.parse((await readBody(req)) || '{}').profile);
      } catch (error) {
        return send(res, 400, { ok: false, error: error instanceof Error ? error.message : '资料格式错误' });
      }
      db.prepare('UPDATE projects SET profile_json = ? WHERE id = ?').run(JSON.stringify(profile), id);
      const row = db
        .prepare('SELECT id, name, created_at, profile_json, plan_text, draft_text, phase, overrides_json FROM projects WHERE id = ?')
        .get(id);
      return send(res, 200, { ok: true, project: toProjectJson(row) });
    }

    // 6) 读某项目的全部消息(老项目自动补开场白)
    const msgList = url.pathname.match(/^\/api\/projects\/(\d+)\/messages$/);
    if (req.method === 'GET' && msgList) {
      const id = Number(msgList[1]);
      const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
      if (!exists) return send(res, 404, { ok: false, error: '项目不存在' });
      return send(res, 200, { ok: true, messages: readMessagesWithOpening(id) });
    }

    // 7) 统一对话路径(步骤1:阶段机已下线,不再按 phase 锁死分支)
    //    用户消息存档 -> 过渡回复(明确标注 AI升级中,步骤2换真实模型) -> 诚实性网关 -> 返回
    const chat = url.pathname.match(/^\/api\/projects\/(\d+)\/chat$/);
    if (req.method === 'POST' && chat) {
      const id = Number(chat[1]);
      const load = () => db
        .prepare('SELECT id, name, created_at, profile_json, plan_text, draft_text, phase, overrides_json FROM projects WHERE id = ?')
        .get(id);
      const row = load();
      if (!row) return send(res, 404, { ok: false, error: '项目不存在' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) return send(res, 400, { ok: false, error: 'text 不能为空' });
      if (text.length > 2000) return send(res, 400, { ok: false, error: 'text 最多2000字' });
      insertMessage(id, 'user', text);
      const reply = honestReply(transitionReply(text));
      insertMessage(id, 'assistant', reply);
      const current = load();
      return send(res, 200, { ok: true, mode: TRANSITION_MODE, reply: { author: 'assistant', text: reply }, done: current.phase === 'done', project: toProjectJson(current) });
    }

    return send(res, 404, { ok: false, error: '没有这个接口' });
  } catch (err) {
    return send(res, 500, { ok: false, error: '服务器内部错误' });
  }
});

// 必须监听 0.0.0.0,预览链接才能从浏览器打开
const PORT = Number(process.env.PORT ?? 3001);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`dimspace-server listening on http://0.0.0.0:${PORT}`);
});
