// 后端测试:Node 自带运行器(node --test),用临时库,不碰真实数据
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'dimspace-test-'));
const dbFile = join(dir, 'test.db');

// 先造一个"任务1时代的老库":没有 profile_json 列,但已有1条老数据
{
  const old = new DatabaseSync(dbFile);
  old.exec('CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL)');
  old.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)').run('老项目', '2026-09-10T00:00:00.000Z');
  old.close();
}

let child;
let token;
const waitReady = async () => {
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error('测试后端启动超时');
    await new Promise((r) => setTimeout(r, 200));
  }
};

before(async () => {
  child = spawn('node', ['server/index.mjs'], {
    env: { ...process.env, PORT: String(PORT), DB_FILE: dbFile },
    stdio: 'ignore',
  });
  await waitReady();
  const login = await fetch(`${BASE}/api/auth/login-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800001111', code: '123456' }),
  });
  token = (await login.json()).token;
});

after(() => child?.kill());

const authed = (method, path, body) => fetch(`${BASE}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('商品资料接口', () => {
  it('老库自动迁移:老数据还在(直查库),且无主老数据不对任何用户可见', async () => {
    const db = new DatabaseSync(dbFile);
    const row = db.prepare('SELECT name, profile_json, user_id FROM projects WHERE id = 1').get();
    db.close();
    assert.equal(row.name, '老项目');
    assert.equal(row.profile_json, null);
    assert.equal(row.user_id, null);
    // 无主老数据安全默认:登录用户也看不到
    const list = await (await authed('GET', '/api/projects')).json();
    assert.equal(list.count, 0);
  });

  let pid;
  it('PUT 保存资料后,GET 原样返回', async () => {
    const created = await (await authed('POST', '/api/projects', { name: '资料店' })).json();
    pid = created.project.id;
    const profile = {
      productName: '云南白茶',
      category: '茶叶',
      price: '99元/500g',
      specs: '500g/袋',
      sellingPoints: '高山茶园,手工采摘',
      notes: '新品首发',
      hacker: 'drop table', // 不在白名单,应被丢掉
    };
    const put = await authed('PUT', `/api/projects/${pid}`, { profile });
    assert.equal(put.status, 200);
    const saved = await put.json();
    assert.equal(saved.ok, true);
    assert.deepEqual(saved.project.profile, {
      productName: '云南白茶',
      category: '茶叶',
      price: '99元/500g',
      specs: '500g/袋',
      sellingPoints: '高山茶园,手工采摘',
      notes: '新品首发',
    });
    assert.ok(!('hacker' in saved.project.profile));

    const get = await authed('GET', `/api/projects/${pid}`);
    const again = await get.json();
    assert.deepEqual(again.project.profile.productName, '云南白茶');
    assert.deepEqual(again.project.profile.price, '99元/500g');
  });

  it('非法输入返回400人话错误,不炸服务', async () => {
    const badShape = await authed('PUT', `/api/projects/${pid}`, { profile: '不是对象' });
    assert.equal(badShape.status, 400);
    const badType = await authed('PUT', `/api/projects/${pid}`, { profile: { price: 99 } });
    assert.equal(badType.status, 400);
    const tooLong = await authed('PUT', `/api/projects/${pid}`, { profile: { notes: 'x'.repeat(2001) } });
    assert.equal(tooLong.status, 400);
    const missing = await authed('PUT', '/api/projects/999', { profile: {} });
    assert.equal(missing.status, 404);
    // 未登录一律 401
    const anon = await fetch(`${BASE}/api/projects/${pid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: {} }),
    });
    assert.equal(anon.status, 401);
    // 服务还活着
    assert.ok((await fetch(`${BASE}/health`)).ok);
  });
});
