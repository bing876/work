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
});

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
      const rows = db.prepare('SELECT id, name, created_at, profile_json FROM projects ORDER BY id').all();
      return send(res, 200, { ok: true, count: rows.length, projects: rows.map(toProjectJson) });
    }

    // 3) 创建项目
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return send(res, 400, { ok: false, error: 'name 不能为空' });
      if (name.length > 100) return send(res, 400, { ok: false, error: 'name 最多100个字' });
      const result = db
        .prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)')
        .run(name, now());
      const row = db
        .prepare('SELECT id, name, created_at, profile_json FROM projects WHERE id = ?')
        .get(Number(result.lastInsertRowid));
      return send(res, 201, { ok: true, project: toProjectJson(row) });
    }

    // 4) 单个项目
    const single = url.pathname.match(/^\/api\/projects\/(\d+)$/);
    if (req.method === 'GET' && single) {
      const row = db
        .prepare('SELECT id, name, created_at, profile_json FROM projects WHERE id = ?')
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
        .prepare('SELECT id, name, created_at, profile_json FROM projects WHERE id = ?')
        .get(id);
      return send(res, 200, { ok: true, project: toProjectJson(row) });
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
