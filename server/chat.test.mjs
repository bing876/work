// 步骤2:模型对话全链路测试。用本地桩模型(OpenAI-compatible 协议)+临时库,不碰真实数据和真 Key
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const STUB_PORT = 3121;
const MAIN_PORT = 3112;
const NOKEY_PORT = 3113;
const BUDGET_PORT = 3114;
const dir = mkdtempSync(join(tmpdir(), 'dimspace-chat-'));
const dbMain = join(dir, 'main.db');
const dbNoKey = join(dir, 'nokey.db');
const dbBudget = join(dir, 'budget.db');

// ---- 桩模型:只实现 POST /chat/completions ----
let stubMode = 'ok'; // ok | error500 | slow | claim
let lastRequest = null;
const stub = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    lastRequest = JSON.parse(body);
    const send = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (stubMode === 'error500') return send(500, { error: { message: 'stub exploded' } });
    if (stubMode === 'slow') return setTimeout(() => send(200, { choices: [{ message: { content: 'too late' } }], usage: {} }), 3000);
    const lastUser = [...lastRequest.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const content = stubMode === 'claim' ? '我已经帮你发布到店铺了' : `STUB收到:${lastUser.slice(0, 30)}`;
    return send(200, { choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } });
  });
});

const children = [];
const waitReady = async (port) => {
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error(`测试后端启动超时:${port}`);
    await new Promise((r) => setTimeout(r, 200));
  }
};
const spawnServer = (port, dbFile, extraEnv = {}) => {
  const child = spawn('node', ['server/index.mjs'], {
    env: { ...process.env, PORT: String(port), DB_FILE: dbFile, ...extraEnv },
    stdio: 'ignore',
  });
  children.push(child);
  return waitReady(port);
};

before(async () => {
  await new Promise((resolve) => stub.listen(STUB_PORT, '127.0.0.1', resolve));
  const modelEnv = { MODEL_BASE_URL: `http://127.0.0.1:${STUB_PORT}`, MODEL_API_KEY: 'test-key', MODEL_NAME: 'stub', MODEL_TIMEOUT_MS: '1500', MODEL_BUDGET_TOKENS: '100000' };
  await spawnServer(MAIN_PORT, dbMain, modelEnv);
  await spawnServer(NOKEY_PORT, dbNoKey); // 无 MODEL_* 
  await spawnServer(BUDGET_PORT, dbBudget, { ...modelEnv, MODEL_BUDGET_TOKENS: '50' }); // 桩每次120 tokens,第2次必超
});
after(() => {
  for (const child of children) child?.kill();
  stub.close();
});

const api = (port) => {
  const base = `http://127.0.0.1:${port}`;
  return {
    post: (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    create: async (name, initialMessage) => (await (await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, initialMessage }) })).json()),
    chat: async (id, text) => {
      const res = await fetch(`${base}/api/projects/${id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      return { status: res.status, ...(await res.json()) };
    },
    messagesOf: async (id) => (await (await fetch(`${base}/api/projects/${id}/messages`)).json()).messages,
  };
};
const main = api(MAIN_PORT);
const nokey = api(NOKEY_PORT);
const budget = api(BUDGET_PORT);

describe('模型对话', () => {
  it('成功:mode=model,system提示词+历史发给模型,用量记账,双方存档', async () => {
    stubMode = 'ok';
    const data = await main.create('模型店', '我想卖茶叶');
    assert.equal(data.project.phase, 'consulting');
    assert.match(data.messages[2].text, /^STUB收到:我想卖茶叶/);
    assert.equal(lastRequest.model, 'stub');
    assert.equal(lastRequest.messages[0].role, 'system');
    assert.match(lastRequest.messages[0].content, /项目负责人/);
    assert.match(lastRequest.messages[0].content, /电商经营参考/);
    const db = new DatabaseSync(dbMain);
    const usage = db.prepare('SELECT * FROM model_usage WHERE project_id = ?').get(data.project.id);
    db.close();
    assert.equal(usage.model, 'stub');
    assert.equal(usage.prompt_tokens, 100);
    assert.equal(usage.completion_tokens, 20);
    const answer = await main.chat(data.project.id, '但我还没货源');
    assert.equal(answer.status, 200);
    assert.equal(answer.mode, 'model');
    assert.match(answer.reply.text, /^STUB收到:但我还没货源/);
  });

  it('多轮:上下文逐轮带给模型,最后一条是当前用户输入', async () => {
    stubMode = 'ok';
    const data = await main.create('多轮店', '第一句');
    await main.chat(data.project.id, '第二句');
    const roles = lastRequest.messages.map((m) => m.role);
    assert.deepEqual(roles, ['system', 'assistant', 'user', 'assistant', 'user']);
    assert.match(lastRequest.messages.at(-1).content, /第二句/);
  });

  it('上游500:502明确报错+可重试;重发同一句不重复存档用户消息', async () => {
    stubMode = 'ok';
    const data = await main.create('重试店', '先聊一句');
    stubMode = 'error500';
    const failed = await main.chat(data.project.id, '这句会失败');
    assert.equal(failed.status, 502);
    assert.equal(failed.code, 'MODEL_CALL_FAILED');
    assert.equal(failed.retryable, true);
    assert.match(failed.error, /stub exploded/);
    const before = await main.messagesOf(data.project.id);
    assert.equal(before.filter((m) => m.author === 'user').length, 2); // 用户话已存档,AI未回复
    stubMode = 'ok';
    const retried = await main.chat(data.project.id, '这句会失败'); // 重试按钮重发同一句
    assert.equal(retried.status, 200);
    const after = await main.messagesOf(data.project.id);
    assert.equal(after.filter((m) => m.author === 'user').length, 2); // 去重生效,仍是2条
    assert.equal(after.length, before.length + 1); // 只多一条AI回复
  });

  it('超时:504 + MODEL_TIMEOUT,明确可重试', async () => {
    stubMode = 'ok';
    const data = await main.create('超时店', 'hi');
    stubMode = 'slow'; // 桩拖延3秒,测试超时设1500毫秒
    const answer = await main.chat(data.project.id, '这句会超时');
    assert.equal(answer.status, 504);
    assert.equal(answer.code, 'MODEL_TIMEOUT');
    assert.equal(answer.retryable, true);
    stubMode = 'ok';
  });

  it('诚实性网关端到端:模型声称“已发布”会被追加说明', async () => {
    stubMode = 'ok';
    const data = await main.create('网关店', 'hi');
    stubMode = 'claim';
    const answer = await main.chat(data.project.id, '帮我发布');
    assert.equal(answer.status, 200);
    assert.match(answer.reply.text, /诚实性说明/);
    assert.match(answer.reply.text, /需要您手动完成/);
    stubMode = 'ok';
  });

  it('无Key:503明确报错不伪装;服务照常启动;建项目带 modelError', async () => {
    const health = await fetch(`http://127.0.0.1:${NOKEY_PORT}/api/projects`);
    assert.equal(health.status, 200); // 无Key不影响启动和读取
    const data = await nokey.create('无Key店');
    const answer = await nokey.chat(data.project.id, 'hi');
    assert.equal(answer.status, 503);
    assert.equal(answer.code, 'MODEL_NOT_CONFIGURED');
    assert.equal(answer.retryable, true);
    assert.match(answer.error, /MODEL_API_KEY/);
    const created = await nokey.create('无Key首话店', '第一句话');
    assert.equal(created.messages.length, 2); // 只有开场+用户,无AI回复
    assert.match(created.modelError, /MODEL_API_KEY/);
  });

  it('超预算:第1次放行记账,第2次429拦截并明示', async () => {
    stubMode = 'ok';
    const data = await budget.create('预算店', 'hi');
    assert.equal(data.messages.length, 3);
    const blocked = await budget.chat(data.project.id, '再聊一句');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.code, 'MODEL_BUDGET_EXCEEDED');
    assert.match(blocked.error, /已超模型预算/);
  });

  it('空消息/超长/不存在的项目仍被拒绝', async () => {
    const data = await main.create('校验店');
    assert.equal((await main.post(`/api/projects/${data.project.id}/chat`, { text: '   ' })).status, 400);
    assert.equal((await main.post(`/api/projects/${data.project.id}/chat`, { text: 'x'.repeat(2001) })).status, 400);
    assert.equal((await main.post('/api/projects/999/chat', { text: 'hi' })).status, 404);
  });
});
