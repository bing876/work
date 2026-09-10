// 阶段对话测试:咨询->收集->确认->执行<->暂停->完成,不碰真实数据
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
const create = async (name, initialMessage) => (await (await post('/api/projects', { name, initialMessage })).json());
const chat = async (id, text) => (await (await post(`/api/projects/${id}/chat`, { text })).json());

describe('阶段流转', () => {
  it('创建后在自由咨询,提问只回答不执行', async () => {
    const data = await create('咨询店');
    assert.equal(data.project.phase, 'consulting');
    assert.match(data.messages[0].text, /AI产品经理/);
    const answer = await chat(data.project.id, '你能做什么？');
    assert.equal(answer.project.phase, 'consulting');
    assert.equal(answer.done, false);
    assert.match(answer.reply.text, /我能为您做什么/);
    assert.match(answer.reply.text, /将交付/);
    assert.match(answer.reply.text, /还不能/);
  });

  it('说清意图后转入收集并明确标注', async () => {
    const data = await create('收集店');
    const reply = await chat(data.project.id, '我想卖茶叶');
    assert.equal(reply.project.phase, 'collecting');
    assert.match(reply.reply.text, /明白了，您要做茶叶生意/);
    assert.match(reply.reply.text, /正在整理需求/);
  });

  it('创建时带第一句话直接进入收集', async () => {
    const data = await create('茶店', '我想卖茶叶');
    assert.equal(data.project.phase, 'collecting');
    assert.equal(data.messages.length, 3);
    assert.match(data.messages[2].text, /上架资料/);
  });

  it('答满5题进入确认:复述需求+任务列表+交付预览+请确认', async () => {
    const data = await create('确认店', '我想卖茶叶');
    const id = data.project.id;
    for (const text of ['云南白茶', '99元', '白领', '淘宝']) await chat(id, text);
    // 此时已答满5题进入确认阶段,第6句话会被引导先确认
    const preview = await chat(id, '随便说一句');
    assert.equal(preview.project.phase, 'confirming');
    assert.match(preview.reply.text, /请先确认方案/);
  });

  it('确认页展示完整方案,纠错后更新,确认后分步执行', async () => {
    const data = await create('执行店', '我想卖茶叶');
    const id = data.project.id;
    for (const text of ['云南白茶', '99元', '白领', '淘宝']) await chat(id, text);
    const confirming = await (await fetch(`${BASE}/api/projects/${id}`)).json();
    assert.equal(confirming.project.phase, 'confirming');
    assert.equal(confirming.project.profile, null); // 确认前不保存

    const messages = await (await fetch(`${BASE}/api/projects/${id}/messages`)).json();
    const lastAgent = messages.messages.filter((m) => m.author === 'assistant').pop().text;
    assert.match(lastAgent, /我理解您的需求是/);
    assert.match(lastAgent, /我准备执行以下任务/);
    assert.match(lastAgent, /请确认开始执行/);

    const corrected = await chat(id, '价格改成199元');
    assert.equal(corrected.project.phase, 'confirming');
    assert.match(corrected.reply.text, /已更新:价格 → 199元/);

    const step1 = await chat(id, '确认');
    assert.equal(step1.project.phase, 'executing');
    assert.match(step1.reply.text, /1\/3 项目档案已生成/);
    assert.equal(step1.project.profile.price, '199元'); // 纠错后的值生效

    const paused = await chat(id, '暂停一下');
    assert.equal(paused.project.phase, 'paused');
    const resumed = await chat(id, '继续');
    assert.equal(resumed.project.phase, 'executing');
    assert.match(resumed.reply.text, /2\/3 执行计划已生成/);

    const final = await chat(id, '继续');
    assert.equal(final.done, true);
    assert.equal(final.project.phase, 'done');
    assert.match(final.reply.text, /初版上架文案/);
    assert.match(final.project.draft, /标题:云南白茶/);

    const extra = await chat(id, '再问一个');
    assert.equal(extra.done, true);
    assert.match(extra.reply.text, /任务5/);
  });

  it('执行中可直接调整,空消息和不存在的项目被拒绝', async () => {
    const data = await create('调整店', '我想卖茶叶');
    const id = data.project.id;
    for (const text of ['云南白茶', '99元', '白领', '淘宝']) await chat(id, text);
    await chat(id, '确认');
    const adjusted = await chat(id, '把价格改成299');
    assert.equal(adjusted.project.phase, 'executing');
    assert.match(adjusted.reply.text, /已把价格改成/);
    assert.equal(adjusted.project.profile.price, '299');
    const empty = await post(`/api/projects/${id}/chat`, { text: '   ' });
    assert.equal(empty.status, 400);
    const missing = await post('/api/projects/999/chat', { text: 'hi' });
    assert.equal(missing.status, 404);
  });

  it('引导式理解:识别生意类型,价格影响文案风格,兜底不卡死', async () => {
    const data = await create('理解店');
    const id = data.project.id;
    const r1 = await chat(id, '我想卖女装');
    assert.match(r1.reply.text, /明白了，您要做服装生意/);
    const r2 = await chat(id, '连衣裙');
    assert.match(r2.reply.text, /正在为您生成商品标题和卖点/);
    const r3 = await chat(id, '899元');
    assert.match(r3.reply.text, /偏向高端质感/);
    const data2 = await create('兜底店');
    const fallback = await chat(data2.project.id, '想做点小生意');
    assert.match(fallback.reply.text, /我来帮您推进/);
  });
});
