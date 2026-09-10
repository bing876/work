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
    if (stubMode === 'consensus') {
      return send(200, { choices: [{ message: { content: '正文回答。\n【记住】\n先做代发试水\n主做茶叶\n【记住结束】' } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } });
    }
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
    getConsensus: async (id) => (await (await fetch(`${base}/api/projects/${id}/consensus`)).json()),
    putConsensus: async (id, body) => {
      const res = await fetch(`${base}/api/projects/${id}/consensus`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: res.status, ...(await res.json()) };
    },
    getSummary: async (id) => (await (await fetch(`${base}/api/projects/${id}/summary`)).json()),
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
    assert.match(lastRequest.messages[0].content, /【记住】/);
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

describe('项目记忆', () => {
  it('“也许”首话自动入库决定区(低置信度),无待确认环节', async () => {
    stubMode = 'ok';
    const data = await main.create('记忆店', '也许可以投入两万元');
    assert.equal(data.consensus.suggestions.length, 0);
    assert.equal(data.consensus.decisions.length, 1);
    assert.equal(data.consensus.decisions[0].status, 'decided');
    assert.equal(data.consensus.decisions[0].confidence, 'low');
    assert.equal(data.consensus.decisions[0].origin, 'user-guess');
  });

  it('AI【记住】块静默入库:展示无标记无附注,决定/事实按 hint 分流', async () => {
    stubMode = 'consensus';
    const data = await main.create('记住店', '聊聊');
    assert.equal(data.consensus.decisions.length, 1); // 先做代发试水 -> decision
    assert.equal(data.consensus.facts.length, 1); // 主做茶叶 -> fact
    const shown = data.messages[2].text;
    assert.doesNotMatch(shown, /记住/);
    assert.doesNotMatch(shown, /记入/);
    assert.match(shown, /正文回答/);
    stubMode = 'ok';
  });

  it('已记住注入 system:第二轮提示词含旧记忆供判断冲突', async () => {
    stubMode = 'ok';
    const data = await main.create('注入店', '也许预算两万');
    await main.chat(data.project.id, '继续');
    assert.match(lastRequest.messages[0].content, /已记住/);
    assert.match(lastRequest.messages[0].content, /预算两万/);
  });

  it('同主题冲突自动过期旧条目进 history,不问用户', async () => {
    stubMode = 'ok';
    const data = await main.create('冲突店', '也许预算两万');
    await main.chat(data.project.id, '也许预算五千');
    const fetched = await main.getConsensus(data.project.id);
    assert.equal(fetched.consensus.decisions.length, 1);
    assert.equal(fetched.consensus.decisions[0].text, '也许预算五千');
    assert.equal(fetched.consensus.history.length, 1);
    assert.equal(fetched.consensus.history[0].text, '也许预算两万');
    assert.equal(fetched.consensus.history[0].status, 'expired');
  });

  it('纠正:旧版进历史新版入库;非法纠正拒绝', async () => {
    stubMode = 'ok';
    const data = await main.create('纠正店', '也许预算五千');
    const id = data.consensus.decisions[0].id;
    const bad1 = await main.putConsensus(data.project.id, { op: 'correct', id: 'nope', text: 'x' });
    assert.equal(bad1.status, 400);
    const bad2 = await main.putConsensus(data.project.id, { op: 'correct', id, text: '  ' });
    assert.equal(bad2.status, 400);
    const bad3 = await main.putConsensus(data.project.id, { op: 'confirm', id, as: 'fact' });
    assert.equal(bad3.status, 400); // 确认流程已取消
    const done = await main.putConsensus(data.project.id, { op: 'correct', id, text: '预算一万' });
    assert.equal(done.status, 200);
    assert.equal(done.consensus.decisions[0].text, '预算一万');
    assert.equal(done.consensus.decisions[0].confidence, 'high');
    assert.equal(done.consensus.history.length, 1);
  });

  it('摘要接口:记住什么 + 低置信度提示;不存在的项目 404', async () => {
    stubMode = 'ok';
    const data = await main.create('摘要店', '也许预算两万');
    const summary = await main.getSummary(data.project.id);
    assert.equal(summary.ok, true);
    assert.match(summary.summary.text, /记住了1条/);
    assert.match(summary.summary.text, /可能不准/);
    assert.equal(summary.summary.uncertain.length, 1);
    const missing = await main.getSummary(999);
    assert.equal(missing.ok, false);
  });
});
