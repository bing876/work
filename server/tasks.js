// 步骤4+5:任务领域函数。HTTP 路由与对话动作共用同一套,保证行为一致。
// 所有函数第一个参数都是 db 句柄,便于测试直连临时库。
export const TASKS_DDL = `
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'proposed',
    proposal_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    confirmed_at TEXT
  )
`;
const now = () => new Date().toISOString();

export const toTaskJson = (row) => ({
  id: row.id,
  title: row.title,
  detail: row.detail ?? '',
  status: row.status,
  proposalVersion: row.proposal_version,
  created_at: row.created_at,
  confirmed_at: row.confirmed_at ?? null,
});
export const normalizeTaskInput = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body 必须是对象');
  const out = {};
  if (value.title !== undefined) {
    if (typeof value.title !== 'string' || !value.title.trim()) throw new Error('title 不能为空');
    if (value.title.trim().length > 200) throw new Error('title 最多200个字');
    out.title = value.title.trim();
  }
  if (value.detail !== undefined) {
    if (typeof value.detail !== 'string') throw new Error('detail 必须是字符串');
    if (value.detail.length > 2000) throw new Error('detail 最多2000字');
    out.detail = value.detail;
  }
  return out;
};
export const getTask = (db, projectId, taskId) =>
  db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(taskId, projectId);
export const listTasks = (db, projectId) =>
  db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY id').all(projectId);

// 建方案:调用方保证项目存在、输入已校验
export const createTask = (db, projectId, input) => {
  const id = Number(
    db.prepare('INSERT INTO tasks (project_id, title, detail, created_at) VALUES (?, ?, ?, ?)').run(projectId, input.title, input.detail ?? '', now()).lastInsertRowid,
  );
  return getTask(db, projectId, id);
};
// 修订:仅 proposed 可改,版本号+1;已确认/已取消锁死
export const reviseTask = (db, projectId, taskId, input) => {
  const task = getTask(db, projectId, taskId);
  if (!task) return { ok: false, code: 'NOT_FOUND' };
  if (task.status !== 'proposed') return { ok: false, code: 'LOCKED', status: task.status };
  db.prepare('UPDATE tasks SET title = ?, detail = ?, proposal_version = proposal_version + 1 WHERE id = ?').run(
    input.title ?? task.title, input.detail ?? task.detail, task.id);
  return { ok: true, task: getTask(db, projectId, task.id) };
};
// 显式确认:版本号必须对上;重复确认幂等(不碰 confirmed_at)
export const confirmTask = (db, projectId, taskId, version) => {
  const task = getTask(db, projectId, taskId);
  if (!task) return { ok: false, code: 'NOT_FOUND' };
  if (version !== task.proposal_version) {
    return { ok: false, code: 'STALE', status: task.status, currentVersion: task.proposal_version };
  }
  if (task.status === 'confirmed') return { ok: true, idempotent: true, task };
  if (task.status !== 'proposed') return { ok: false, code: 'LOCKED', status: task.status };
  db.prepare("UPDATE tasks SET status = 'confirmed', confirmed_at = ? WHERE id = ?").run(now(), task.id);
  return { ok: true, idempotent: false, task: getTask(db, projectId, task.id) };
};
// 取消:proposed/confirmed 都可取消;已取消再取幂等
export const cancelTask = (db, projectId, taskId) => {
  const task = getTask(db, projectId, taskId);
  if (!task) return { ok: false, code: 'NOT_FOUND' };
  if (task.status === 'cancelled') return { ok: true, idempotent: true, task };
  db.prepare("UPDATE tasks SET status = 'cancelled' WHERE id = ?").run(task.id);
  return { ok: true, idempotent: false, task: getTask(db, projectId, task.id) };
};
// 待确认清单(注入 system prompt,供模型确认/取消/修订时对编号)
export const pendingText = (db, projectId) =>
  listTasks(db, projectId)
    .filter((t) => t.status === 'proposed')
    .slice(0, 5)
    .map((t) => `#${t.id} ${t.title}(第${t.proposal_version}版)${t.detail ? `:${t.detail.slice(0, 100)}` : ''}`)
    .join('\n');
