// 步骤4:任务确认门测试。起真实服务+临时库(不调模型),全 HTTP 级验证
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 3115;
const dbFile = join(mkdtempSync(join(tmpdir(), 'dimspace-tasks-')), 'tasks.db');
let child;
let token;
const waitReady = async () => {
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error('测试后端启动超时:3115');
    await new Promise((r) => setTimeout(r, 200));
  }
};
before(async () => {
  child = spawn('node', ['server/index.mjs'], { env: { ...process.env, PORT: String(PORT), DB_FILE: dbFile }, stdio: 'ignore' });
  await waitReady();
  const login = await fetch(`http://127.0.0.1:${PORT}/api/auth/login-phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13800009999', code: '123456' }) });
  token = (await login.json()).token;
});
after(() => child?.kill());

const base = `http://127.0.0.1:${PORT}`;
const req = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
let projectId;
let otherProjectId;

describe('步骤4 任务确认门', () => {
  it('建项目(无首句,不调模型)', async () => {
    const a = await req('POST', '/api/projects', { name: '确认门店' });
    assert.equal(a.status, 201);
    projectId = a.json.project.id;
    const b = await req('POST', '/api/projects', { name: '隔离店' });
    otherProjectId = b.json.project.id;
  });

  it('建方案:201,默认 proposed/v1', async () => {
    const { status, json } = await req('POST', `/api/projects/${projectId}/tasks`, { title: '发调价通知', detail: '全场涨5%' });
    assert.equal(status, 201);
    assert.equal(json.task.title, '发调价通知');
    assert.equal(json.task.status, 'proposed');
    assert.equal(json.task.proposalVersion, 1);
    assert.equal(json.task.confirmed_at, null);
  });

  it('校验:title 缺失→400;项目不存在→404', async () => {
    assert.equal((await req('POST', `/api/projects/${projectId}/tasks`, { detail: 'x' })).status, 400);
    assert.equal((await req('POST', '/api/projects/9999/tasks', { title: 'x' })).status, 404);
    assert.equal((await req('GET', '/api/projects/9999/tasks')).status, 404);
    assert.equal((await req('POST', '/api/projects/9999/tasks/1/confirm', { proposalVersion: 1 })).status, 404);
  });

  it('列表:返回所建任务', async () => {
    const { status, json } = await req('GET', `/api/projects/${projectId}/tasks`);
    assert.equal(status, 200);
    assert.equal(json.tasks.length, 1);
    assert.equal(json.tasks[0].title, '发调价通知');
  });

  it('确认 happy path:200,状态翻 confirmed', async () => {
    const { status, json } = await req('POST', `/api/projects/${projectId}/tasks/1/confirm`, { proposalVersion: 1 });
    assert.equal(status, 200);
    assert.equal(json.idempotent, false);
    assert.equal(json.task.status, 'confirmed');
    assert.ok(json.task.confirmed_at);
  });

  it('幂等:重复确认→200,不改 confirmed_at', async () => {
    const first = await req('POST', `/api/projects/${projectId}/tasks/1/confirm`, { proposalVersion: 1 });
    const second = await req('POST', `/api/projects/${projectId}/tasks/1/confirm`, { proposalVersion: 1 });
    assert.equal(second.status, 200);
    assert.equal(second.json.idempotent, true);
    assert.equal(second.json.task.confirmed_at, first.json.task.confirmed_at);
  });

  it('版本过期:修订后旧版确认→409,新版→200', async () => {
    const created = await req('POST', `/api/projects/${projectId}/tasks`, { title: '上新茶叶' });
    const tid = created.json.task.id;
    const revised = await req('PUT', `/api/projects/${projectId}/tasks/${tid}`, { detail: '先上3款' });
    assert.equal(revised.status, 200);
    assert.equal(revised.json.task.proposalVersion, 2);
    const stale = await req('POST', `/api/projects/${projectId}/tasks/${tid}/confirm`, { proposalVersion: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.currentVersion, 2);
    const fresh = await req('POST', `/api/projects/${projectId}/tasks/${tid}/confirm`, { proposalVersion: 2 });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.json.task.status, 'confirmed');
  });

  it('已确认任务禁止修订→409;空修订→400', async () => {
    const denied = await req('PUT', `/api/projects/${projectId}/tasks/1`, { title: '偷改' });
    assert.equal(denied.status, 409);
    assert.equal(denied.json.status, 'confirmed');
    const created = await req('POST', `/api/projects/${projectId}/tasks`, { title: '待修订' });
    assert.equal((await req('PUT', `/api/projects/${projectId}/tasks/${created.json.task.id}`, {})).status, 400);
  });

  it('跨项目隔离:A任务用B路径确认→404', async () => {
    const { status } = await req('POST', `/api/projects/${otherProjectId}/tasks/1/confirm`, { proposalVersion: 1 });
    assert.equal(status, 404);
  });

  it('确认 body 非整数版本→400', async () => {
    assert.equal((await req('POST', `/api/projects/${projectId}/tasks/1/confirm`, {})).status, 400);
    assert.equal((await req('POST', `/api/projects/${projectId}/tasks/1/confirm`, { proposalVersion: '1' })).status, 400);
  });
});
