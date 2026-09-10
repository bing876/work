// 访谈流程测试:创建->开场->5问->档案+计划->完成后追问,不碰真实数据
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 3112;
const BASE = `http://127.0.0.1:${PORT}`;
const dbFile = join(mkdtempSync(join(tmpdir(), 'dimspace-chat-')), 'test.db');

let child;
before(async () => {
  child = spawn('node', ['server/index.mjs'], {
    env: { ...process.env, PORT: String(PORT), DB_FILE: dbFile },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error('测试后端启动超时');
    await new Promise((r) => setTimeout(r, 200));
  }
});
after(() => child?.kill());

const post = (path, body) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('访谈流程', () => {
  it('创建项目自动带开场白', async () => {
    const res = await post('/api/projects', { name: '访谈店' });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.messages.length, 1);
    assert.equal(data.messages[0].author, 'assistant');
    assert.match(data.messages[0].text, /项目顾问/);
  });

  it('创建时带第一句话,直接追问第2问', async () => {
    const res = await post('/api/projects', { name: '茶店', initialMessage: '我想卖茶叶' });
    const data = await res.json();
    assert.equal(data.messages.length, 3);
    assert.equal(data.messages[1].text, '我想卖茶叶');
    assert.match(data.messages[2].text, /商品或服务/);
  });

  it('答满5题后自动生成档案和计划', async () => {
    const created = await (await post('/api/projects', { name: '白茶店' })).json();
    const id = created.project.id;
    const answers = ['我想卖茶叶', '云南白茶500g/袋', '25-35岁白领', '99元', '淘宝和抖音'];
    let last;
    for (const text of answers) {
      last = await (await post(`/api/projects/${id}/chat`, { text })).json();
    }
    assert.equal(last.ok, true);
    assert.equal(last.done, true);
    assert.match(last.reply.text, /访谈完成/);
    assert.equal(last.project.profile.productName, '云南白茶500g/袋');
    assert.equal(last.project.profile.price, '99元');
    assert.match(last.project.plan, /执行计划/);
    assert.match(last.project.plan, /淘宝和抖音/);

    const single = await (await fetch(`${BASE}/api/projects/${id}`)).json();
    assert.equal(single.project.profile.category, '我想卖茶叶');
    const messages = await (await fetch(`${BASE}/api/projects/${id}/messages`)).json();
    assert.equal(messages.messages.length, 11); // 开场 + 5问 + 5答
  });

  it('完成后继续追问不再提问,空消息被拒绝', async () => {
    const created = await (await post('/api/projects', { name: '追问店' })).json();
    const id = created.project.id;
    for (let i = 0; i < 5; i++) await post(`/api/projects/${id}/chat`, { text: `回答${i}` });
    const extra = await (await post(`/api/projects/${id}/chat`, { text: '再问一个' })).json();
    assert.equal(extra.done, true);
    assert.match(extra.reply.text, /任务5/);
    const empty = await post(`/api/projects/${id}/chat`, { text: '   ' });
    assert.equal(empty.status, 400);
    const missing = await post('/api/projects/999/chat', { text: 'hi' });
    assert.equal(missing.status, 404);
  });
});
