// 账号系统测试:验证码注册/坐标号登录/JWT 鉴权/用户隔离。真实服务+临时库,不调模型
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { USERS_DDL, allocateCoordinate } from './auth.js';

const PORT = 3116;
const dir = mkdtempSync(join(tmpdir(), 'dimspace-auth-'));
const dbFile = join(dir, 'auth.db');
let child;
const waitReady = async () => {
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error('测试后端启动超时:3116');
    await new Promise((r) => setTimeout(r, 200));
  }
};
before(async () => {
  child = spawn('node', ['server/index.mjs'], { env: { ...process.env, PORT: String(PORT), DB_FILE: dbFile }, stdio: 'ignore' });
  await waitReady();
});
after(() => child?.kill());

const base = `http://127.0.0.1:${PORT}`;
const req = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const PHONE_A = '13800000001';
const PHONE_B = '13800000002';
let tokenA;
let tokenB;
let coordA;
let coordB;

describe('账号系统', () => {
  it('发码:开发固定码提示;坏手机号→400', async () => {
    const { status, json } = await req('POST', '/api/auth/code', { phone: PHONE_A });
    assert.equal(status, 200);
    assert.equal(json.dev, true);
    assert.match(json.message, /123456/);
    assert.equal((await req('POST', '/api/auth/code', { phone: 'abc' })).status, 400);
  });

  it('用例1:新手机验证码注册→自动得随机坐标号+设密码提示', async () => {
    const bad = await req('POST', '/api/auth/login-phone', { phone: PHONE_A, code: '000000' });
    assert.equal(bad.status, 401);
    assert.equal(bad.json.code, 'BAD_CODE');
    const { status, json } = await req('POST', '/api/auth/login-phone', { phone: PHONE_A, code: '123456' });
    assert.equal(status, 200);
    assert.equal(json.registered, true);
    assert.equal(json.needPassword, true);
    assert.match(json.message, /设置登录密码/);
    assert.match(json.user.coordinateId, /^XYZ\d{4,}$/);
    assert.ok(!('password_hash' in json.user));
    assert.ok(json.token.length > 20);
    tokenA = json.token;
    coordA = json.user.coordinateId;
  });

  it('用例2:第二个用户→XYZ1001', async () => {
    const { status, json } = await req('POST', '/api/auth/login-phone', { phone: PHONE_B, code: '123456' });
    assert.equal(status, 200);
    assert.match(json.user.coordinateId, /^XYZ\d{4,}$/);
    assert.notEqual(json.user.coordinateId, coordA);
    coordB = json.user.coordinateId;
    tokenB = json.token;
  });

  it('用例3:设密码后坐标号+密码登录成功;错码/错密明确提示', async () => {
    assert.equal((await req('POST', '/api/auth/set-password', { password: 'secret123' }, tokenA)).status, 200);
    assert.equal((await req('POST', '/api/auth/set-password', { password: '123' }, tokenA)).status, 400);
    const ok = await req('POST', '/api/auth/login-id', { coordinateId: coordA, password: 'secret123' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.user.phone, PHONE_A);
    const lower = await req('POST', '/api/auth/login-id', { coordinateId: coordA.toLowerCase(), password: 'secret123' });
    assert.equal(lower.status, 200); // 小写同样认
    const wrongPw = await req('POST', '/api/auth/login-id', { coordinateId: coordA, password: 'nope-nope' });
    assert.equal(wrongPw.status, 401);
    assert.match(wrongPw.json.error, /密码错误/);
    const noId = await req('POST', '/api/auth/login-id', { coordinateId: 'XYZ100000000', password: 'x' });
    assert.equal(noId.status, 401);
    assert.match(noId.json.error, /坐标号不存在/);
    const noPw = await req('POST', '/api/auth/login-id', { coordinateId: coordB, password: 'x' });
    assert.equal(noPw.status, 401);
    assert.match(noPw.json.error, /尚未设置密码/);
    assert.equal((await req('POST', '/api/auth/login-id', { coordinateId: 'ABC', password: 'x' })).status, 400);
  });

  it('用例4:已注册手机验证码直接登录;me 返回身份', async () => {
    const { status, json } = await req('POST', '/api/auth/login-phone', { phone: PHONE_A, code: '123456' });
    assert.equal(status, 200);
    assert.equal(json.registered, false);
    assert.equal(json.needPassword, false);
    const me = await req('GET', '/api/auth/me', undefined, json.token);
    assert.equal(me.status, 200);
    assert.equal(me.json.user.coordinateId, coordA);
  });

  it('用例5:A 建项目 B 查不到(列表/单查/改资料/聊天/任务全隔离)', async () => {
    const created = await req('POST', '/api/projects', { name: 'A的店' }, tokenA);
    assert.equal(created.status, 201);
    const pid = created.json.project.id;
    assert.equal((await req('GET', '/api/projects', undefined, tokenA)).json.count, 1);
    assert.equal((await req('GET', '/api/projects', undefined, tokenB)).json.count, 0);
    assert.equal((await req('GET', `/api/projects/${pid}`, undefined, tokenB)).status, 404);
    assert.equal((await req('PUT', `/api/projects/${pid}`, { profile: {} }, tokenB)).status, 404);
    assert.equal((await req('GET', `/api/projects/${pid}/messages`, undefined, tokenB)).status, 404);
    assert.equal((await req('GET', `/api/projects/${pid}/consensus`, undefined, tokenB)).status, 404);
    assert.equal((await req('POST', `/api/projects/${pid}/chat`, { text: '嗨' }, tokenB)).status, 404);
    const task = await req('POST', `/api/projects/${pid}/tasks`, { title: 'A的任务' }, tokenA);
    assert.equal(task.status, 201);
    assert.equal((await req('POST', `/api/projects/${pid}/tasks/${task.json.task.id}/confirm`, { proposalVersion: 1 }, tokenB)).status, 404);
    assert.equal((await req('GET', `/api/projects/${pid}`, undefined, tokenA)).status, 200);
  });

  it('用例6:未登录/伪造 Token 访问业务接口→401', async () => {
    for (const [method, path, body] of [['GET', '/api/projects'], ['POST', '/api/projects', { name: 'x' }], ['POST', '/api/projects/1/chat', { text: 'x' }], ['GET', '/api/projects/1/consensus']]) {
      assert.equal((await req(method, path, body)).status, 401);
      const forged = await req(method, path, body, 'forged.token.here');
      assert.equal(forged.status, 401);
      assert.equal(forged.json.code, 'UNAUTHORIZED');
    }
    assert.ok((await fetch(`${base}/health`)).ok); // 健康检查仍公开
  });

  it('坐标号随机分配:候选撞号自动换号(伪随机序列,确定性)', () => {
    const mem = new DatabaseSync(join(dir, 'coord.db'));
    mem.exec(USERS_DDL);
    const orig = Math.random;
    try {
      Math.random = () => 0;
      assert.equal(allocateCoordinate(mem), 'XYZ1000');
      mem.prepare('INSERT INTO users (phone, password_hash, coordinate_id, created_at) VALUES (?, ?, ?, ?)').run('10000000001', null, 'XYZ1000', 't');
      let n = 0;
      Math.random = () => [0, 0.5][n++] ?? 0.9;
      assert.equal(allocateCoordinate(mem), 'XYZ5500'); // 首抽撞号,次抽命中
    } finally {
      Math.random = orig;
    }
    mem.close();
  });
});
