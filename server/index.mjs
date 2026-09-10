// 任务1:最小后端 + SQLite 文件数据库(零第三方依赖,只用 Node 自带模块)
// 接口只有 5 个:
//   GET  /health             健康检查
//   GET  /api/projects       项目列表
//   POST /api/projects       创建项目,Body: {"name": "xxx"}
//   GET  /api/projects/:id   单个项目详情
//   PUT  /api/projects/:id   保存商品资料,Body: {"profile": {"productName": "...", ...}}(任务3新增)
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENING } from './interview.js';
import { honestReply } from './policy.js';
import { ModelError, callModel, loadModelConfig } from './model.js';
import { buildMessages, buildSystemPrompt } from './prompts.js';
import { serveStatic } from './static.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
// 最小 .env 读取:只认 MODEL_* 键,已有环境变量优先;测试(DB_FILE=临时库)时跳过,保证 hermetic
if (!process.env.DB_FILE) {
  const envFile = join(rootDir, '..', '.env');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const match = line.match(/^\s*(MODEL_[A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match && !(match[1] in process.env)) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}
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
db.exec(`
  CREATE TABLE IF NOT EXISTS model_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
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

// 重试去重:同一句话连发且上一条还没有 AI 回复时,不重复存档(重试按钮重发不会产生两条用户消息)
const shouldSkipUserInsert = (projectId, text) => {
  const last = db.prepare('SELECT author, text FROM messages WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId);
  return !!last && last.author === 'user' && last.text === text;
};
// 为项目生成一条 AI 回复:查预算 -> 组装历史 -> 调模型 -> 记用量 -> 诚实性网关 -> 存档
// 失败抛 ModelError,调用方转成明确报错+可重试,绝不伪装
const generateReply = async (projectId) => {
  const config = loadModelConfig();
  if (!config.apiKey) throw new ModelError('MODEL_NOT_CONFIGURED', '模型未配置:缺少 MODEL_API_KEY。请在后端环境变量(或 Secrets)中配置后重启服务再试', true);
  if (config.budgetTokens > 0) {
    const used = db.prepare('SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total FROM model_usage').get().total;
    if (used >= config.budgetTokens) throw new ModelError('MODEL_BUDGET_EXCEEDED', `已超模型预算(累计 ${used}/${config.budgetTokens} tokens)。请提高 MODEL_BUDGET_TOKENS 后重试`, true);
  }
  const history = readMessages(projectId);
  const { text, usage } = await callModel({ config, messages: buildMessages(buildSystemPrompt(), history) });
  db.prepare('INSERT INTO model_usage (project_id, model, prompt_tokens, completion_tokens, created_at) VALUES (?, ?, ?, ?, ?)').run(projectId, config.name, usage.promptTokens, usage.completionTokens, now());
  const reply = honestReply(text);
  insertMessage(projectId, 'assistant', reply);
  return reply;
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

    // 3) 创建项目:自动写入 AI 开场白;如果带了第一句话,存档并调模型回复,失败则带 modelError 返回
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
      let modelError;
      if (initial) {
        insertMessage(id, 'user', initial);
        try {
          await generateReply(id);
        } catch (error) {
          modelError = error instanceof ModelError ? error.message : '模型调用失败';
        }
      }
      const row = db
        .prepare('SELECT id, name, created_at, profile_json, plan_text, draft_text, phase, overrides_json FROM projects WHERE id = ?')
        .get(id);
      return send(res, 201, { ok: true, project: toProjectJson(row), messages: readMessages(id), ...(modelError ? { modelError } : {}) });
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

    // 7) 统一对话:用户消息存档(重试去重) -> 真实模型 -> 诚实性网关 -> 存档返回
    //    失败一律明确报错+可重试:503 未配置 / 429 超预算 / 504 超时 / 502 调用失败
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
      if (!shouldSkipUserInsert(id, text)) insertMessage(id, 'user', text);
      try {
        const reply = await generateReply(id);
        const current = load();
        return send(res, 200, { ok: true, mode: 'model', reply: { author: 'assistant', text: reply }, done: current.phase === 'done', project: toProjectJson(current) });
      } catch (error) {
        if (error instanceof ModelError) {
          const status = error.code === 'MODEL_NOT_CONFIGURED' ? 503 : error.code === 'MODEL_TIMEOUT' ? 504 : error.code === 'MODEL_BUDGET_EXCEEDED' ? 429 : 502;
          return send(res, status, { ok: false, error: error.message, code: error.code, retryable: error.retryable });
        }
        throw error;
      }
    }

    // 8) 生产静态托管:有 dist/ 时托管前端(SPA 回退);无 dist(开发/测试)时走下面 JSON 404
    if ((req.method === 'GET' || req.method === 'HEAD') && !url.pathname.startsWith('/api') && url.pathname !== '/health') {
      if (serveStatic(req, res, join(rootDir, '..', 'dist'))) return;
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
