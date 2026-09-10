// 共识纯函数单元测试:不起服务
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendUnique, applyConfirm, defaultConsensus, detectUserGuess, extractMarked, makeItem } from './consensus.js';

describe('项目共识', () => {
  it('默认结构四区齐全,goal 预留 null', () => {
    assert.deepEqual(defaultConsensus(), { version: 1, goal: null, facts: [], suggestions: [], openQuestions: [], decisions: [] });
  });

  it('标记块提取:多条截断5条,展示文本去掉整块', () => {
    const { items, stripped } = extractMarked('正文\n【共识建议】\n1. 先做代发试水\n2. 首批只上一个品\n【共识建议结束】\n尾巴', '【共识建议】', '【共识建议结束】');
    assert.deepEqual(items, ['先做代发试水', '首批只上一个品']);
    assert.doesNotMatch(stripped, /共识建议/);
    assert.match(stripped, /正文/);
    assert.match(stripped, /尾巴/);
  });

  it('标记块缺一半时不提取、原文不动', () => {
    const { items, stripped } = extractMarked('只有开头【共识建议】\n一条', '【共识建议】', '【共识建议结束】');
    assert.deepEqual(items, []);
    assert.match(stripped, /只有开头/);
  });

  it('用户推测检测:也许/可能进建议,涉及钱/拍板标 decision', () => {
    assert.deepEqual(detectUserGuess('也许可以投入两万元'), { kind: 'decision' });
    assert.deepEqual(detectUserGuess('可能先做代发试试'), { kind: 'decision' });
    assert.deepEqual(detectUserGuess('也许茶叶更好卖一些'), { kind: 'fact' });
    assert.equal(detectUserGuess('我决定做代发'), null); // 肯定句不算推测
    assert.equal(detectUserGuess('你好'), null);
  });

  it('确认:建议→事实/决定,重复确认幂等,未知 id 拒绝', () => {
    const c = defaultConsensus();
    const s = makeItem({ text: '先做代发', kind: 'decision', origin: 'ai', messageId: 1 });
    c.suggestions.push(s);
    const r1 = applyConfirm(c, s.id, 'decision');
    assert.equal(r1.ok, true);
    assert.equal(c.suggestions.length, 0);
    assert.equal(c.decisions.length, 1);
    assert.equal(c.decisions[0].status, 'decided');
    assert.ok(c.decisions[0].confirmedAt);
    const r2 = applyConfirm(c, s.id, 'decision');
    assert.equal(r2.ok, true); // 幂等
    assert.equal(c.decisions.length, 1);
    assert.equal(applyConfirm(c, 'nope', 'fact').ok, false);
    assert.equal(applyConfirm(c, s.id, 'other').ok, false);
  });

  it('追加去重:相同文本不重复进建议区', () => {
    const c = defaultConsensus();
    assert.equal(appendUnique(c.suggestions, makeItem({ text: '同', kind: 'fact', origin: 'ai' })), true);
    assert.equal(appendUnique(c.suggestions, makeItem({ text: '同', kind: 'fact', origin: 'ai' })), false);
    assert.equal(c.suggestions.length, 1);
  });
});
