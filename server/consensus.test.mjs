// 记忆纯函数单元测试:不起服务
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCorrect, buildSummary, defaultConsensus, detectUserGuess, extractMarked, guessDecision, makeItem, saveRemembered, topicKey } from './consensus.js';

describe('项目记忆', () => {
  it('默认结构含 history,版本号 2', () => {
    assert.deepEqual(defaultConsensus(), { version: 2, goal: null, facts: [], suggestions: [], openQuestions: [], decisions: [], history: [] });
  });

  it('标记块提取:多条截断5条,展示文本静默去掉整块(无附注)', () => {
    const { items, stripped } = extractMarked('正文\n【记住】\n1. 预算两万\n2. 主做茶叶\n【记住结束】\n尾巴', '【记住】', '【记住结束】');
    assert.deepEqual(items, ['预算两万', '主做茶叶']);
    assert.doesNotMatch(stripped, /记住/);
    assert.match(stripped, /正文/);
  });

  it('收尾变体【/记住】同样认,多块循环剥离', () => {
    const { items, stripped } = extractMarked(
      '正文\n【记住】\n预算一万\n【/记住】\n中间\n【记住】\n主做茶叶\n【记住结束】',
      '【记住】', ['【记住结束】', '【/记住】', '【记住/】']);
    assert.deepEqual(items, ['预算一万', '主做茶叶']);
    assert.doesNotMatch(stripped, /记住/);
    assert.match(stripped, /正文/);
    assert.match(stripped, /中间/);
  });

  it('未闭合兜底:从【记住】到末尾照样提取并剥掉,用户看不到标记', () => {
    const { items, stripped } = extractMarked('要不先挑一个回我\n【记住】\n用户代发启动预算为一万元', '【记住】', ['【记住结束】', '【/记住】']);
    assert.deepEqual(items, ['用户代发启动预算为一万元']);
    assert.equal(stripped, '要不先挑一个回我');
  });

  it('用户推测检测:也许/可能入库,涉及钱标 decision', () => {
    assert.deepEqual(detectUserGuess('也许可以投入两万元'), { kind: 'decision' });
    assert.deepEqual(detectUserGuess('也许茶叶更好卖一些'), { kind: 'fact' });
    assert.equal(detectUserGuess('我决定做代发'), null);
    assert.equal(guessDecision('预算改成五千'), true);
    assert.equal(guessDecision('主做茶叶'), false);
  });

  it('主题键:预算/渠道/客户/商品可归类,无主题返回 null', () => {
    assert.equal(topicKey('预算两万'), 'budget');
    assert.equal(topicKey('在淘宝卖'), 'channel');
    assert.equal(topicKey('目标客户白领'), 'customer');
    assert.equal(topicKey('今天天气不错'), null);
  });

  it('自动入库:相同文本去重,同主题新条目过期旧条目', () => {
    const c = defaultConsensus();
    const first = makeItem({ text: '预算两万', kind: 'decision', origin: 'user-guess', confidence: 'low' });
    assert.equal(saveRemembered(c, first), 'added');
    assert.equal(c.decisions.length, 1);
    assert.equal(saveRemembered(c, makeItem({ text: '预算两万', kind: 'decision', origin: 'ai' })), 'duplicate');
    assert.equal(c.decisions.length, 1);
    const second = makeItem({ text: '预算五千', kind: 'decision', origin: 'ai' });
    assert.equal(saveRemembered(c, second), 'updated');
    assert.equal(c.decisions.length, 1);
    assert.equal(c.decisions[0].text, '预算五千');
    assert.equal(c.history.length, 1);
    assert.equal(c.history[0].status, 'expired');
    assert.equal(c.history[0].text, '预算两万');
    assert.equal(c.history[0].replacedBy, second.id);
  });

  it('纠正:旧版进历史,新版入库并标高置信度;未知 id 拒绝;空文本拒绝', () => {
    const c = defaultConsensus();
    const item = makeItem({ text: '预算五千', kind: 'decision', origin: 'user-guess', confidence: 'low' });
    c.decisions.push(item);
    const r = applyCorrect(c, item.id, '预算一万');
    assert.equal(r.ok, true);
    assert.equal(c.decisions.length, 1);
    assert.equal(c.decisions[0].text, '预算一万');
    assert.equal(c.decisions[0].confidence, 'high');
    assert.equal(c.decisions[0].correctedFrom, item.id);
    assert.equal(c.history.length, 1);
    assert.equal(c.history[0].text, '预算五千');
    assert.equal(applyCorrect(c, 'nope', 'x').ok, false);
    assert.equal(applyCorrect(c, c.decisions[0].id, '  ').ok, false);
  });

  it('摘要:空记忆/有记忆/低置信度提示', () => {
    const empty = buildSummary(defaultConsensus());
    assert.match(empty.text, /还没有记住/);
    const c = defaultConsensus();
    c.facts.push(makeItem({ text: '主做茶叶', kind: 'fact', origin: 'ai' }));
    c.decisions.push(makeItem({ text: '也许预算两万', kind: 'decision', origin: 'user-guess', confidence: 'low' }));
    const full = buildSummary(c);
    assert.match(full.text, /记住了2条/);
    assert.equal(full.remembered.length, 2);
    assert.equal(full.uncertain.length, 1);
    assert.match(full.text, /可能不准/);
  });
});
