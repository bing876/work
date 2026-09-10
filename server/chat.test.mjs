// 步骤1:统一对话路径测试(阶段机已下线)。用临时库,不碰真实数据
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
const create = async (name, initialMessage) => (await (await post('/api/projects', { name, initialMessage })).json());
const chat = async (id, text) => (await (await post(`/api/projects/${id}/chat`, { text })).json());
const messagesOf = async (id) => (await (await fetch(`${BASE}/api/projects/${id}/messages`)).json()).messages;

describe('统一对话路径', () => {
  it('基本对话:过渡回复明确标注 AI升级中,mode=transition,向后兼容', async () => {
    const data = await create('对话店');
    assert.equal(data.project.phase, 'consulting');
    assert.match(data.messages[0].text, /AI产品经理/);
    const answer = await chat(data.project.id, '你好，随便聊聊');
    assert.equal(answer.ok, true);
    assert.equal(answer.mode, 'transition');
    assert.equal(answer.done, false);
    assert.match(answer.reply.text, /AI升级中/);
    assert.match(answer.reply.text, /存档/);
    assert.ok(answer.project && typeof answer.project.id === 'number'); // 旧字段仍在
    const messages = await messagesOf(data.project.id);
    assert.equal(messages.length, 3); // 开场 + 用户 + 过渡回复,全部存档
    assert.equal(messages[1].author, 'user');
    assert.equal(messages[1].text, '你好，随便聊聊');
  });

  it('验收1:“先不做了”正常对话存档,不再出现暂停/继续话术', async () => {
    const data = await create('咨询店');
    const answer = await chat(data.project.id, '先不做了，我只想了解一下');
    assert.match(answer.reply.text, /AI升级中/);
    assert.match(answer.reply.text, /存档/);
    assert.doesNotMatch(answer.reply.text, /暂停/);
    assert.doesNotMatch(answer.reply.text, /继续/);
  });

  it('验收2:“发布到店铺”允许讨论,明确没有操作权限,不生硬拒绝', async () => {
    const data = await create('发布店');
    const answer = await chat(data.project.id, '把商品发布到店铺');
    assert.match(answer.reply.text, /AI升级中/);
    assert.match(answer.reply.text, /可以帮你准备和讨论/);
    assert.match(answer.reply.text, /没有店铺操作权限/);
    assert.match(answer.reply.text, /手动完成/);
    assert.doesNotMatch(answer.reply.text, /拒绝/);
  });

  it('验收3重点:“写调价通知草稿”正常给草稿,不被拦截(多变体)', async () => {
    const data = await create('草稿店');
    for (const text of ['写个调价通知草稿', '帮我写个调价通知', '给我一份调价通知模板']) {
      const answer = await chat(data.project.id, text);
      assert.match(answer.reply.text, /AI升级中/);
      assert.match(answer.reply.text, /调价通知草稿/);
      assert.doesNotMatch(answer.reply.text, /拦截/);
      assert.doesNotMatch(answer.reply.text, /不能帮/);
      assert.doesNotMatch(answer.reply.text, /拒绝/);
      assert.doesNotMatch(answer.reply.text, /暂不支持/);
    }
  });

  it('历史 phase 不再锁死:executing/paused/collecting/confirming/done 都走统一路径', async () => {
    const db = new DatabaseSync(dbFile);
    for (const phase of ['executing', 'paused', 'collecting', 'confirming', 'done']) {
      const data = await create(`老${phase}店`);
      db.prepare('UPDATE projects SET phase = ? WHERE id = ?').run(phase, data.project.id);
      const answer = await chat(data.project.id, '白茶怎么保存？');
      assert.match(answer.reply.text, /AI升级中/);
      assert.doesNotMatch(answer.reply.text, /说“继续”/);
      assert.doesNotMatch(answer.reply.text, /请先确认方案/);
      assert.doesNotMatch(answer.reply.text, /已暂停/);
      assert.doesNotMatch(answer.reply.text, /上架文案初稿已生成/);
      assert.equal(answer.project.phase, phase); // phase 原值保留,只不再做分支
    }
    db.close();
  });

  it('创建时带第一句话:存档为用户原话,给过渡回复,不再自动收集', async () => {
    const data = await create('首话店', '我想卖茶叶');
    assert.equal(data.project.phase, 'consulting');
    assert.equal(data.messages.length, 3);
    assert.equal(data.messages[1].author, 'user');
    assert.equal(data.messages[1].text, '我想卖茶叶');
    assert.match(data.messages[2].text, /AI升级中/);
    assert.doesNotMatch(data.messages[2].text, /上架资料/);
    assert.doesNotMatch(data.messages[2].text, /正在整理需求/);
  });

  it('空消息/超长/不存在的项目被拒绝', async () => {
    const data = await create('校验店');
    const empty = await post(`/api/projects/${data.project.id}/chat`, { text: '   ' });
    assert.equal(empty.status, 400);
    const long = await post(`/api/projects/${data.project.id}/chat`, { text: 'x'.repeat(2001) });
    assert.equal(long.status, 400);
    const missing = await post('/api/projects/999/chat', { text: 'hi' });
    assert.equal(missing.status, 404);
  });
});
