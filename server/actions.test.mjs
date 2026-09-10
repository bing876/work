// 步骤5:动作协议解析 + 执行单测。直连临时库,不起服务不调模型
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applyDialogueActions, parseActionBlocks } from './actions.js';
import { TASKS_DDL, createTask, getTask, listTasks } from './tasks.js';

describe('parseActionBlocks 解析', () => {
  it('四种块各取所需字段,正文干净剥离', () => {
    const { actions, stripped } = parseActionBlocks(
      '正文\n【提议】\n标题：发调价通知\n内容：周五涨5%\n【提议结束】\n【确认】\n任务：3\n版本：2\n【确认结束】\n【取消】\n任务：4\n【取消结束】\n【修订】\n任务：5\n标题：改后\n【修订结束】',
    );
    assert.deepEqual(actions.map((a) => a.type), ['提议', '确认', '取消', '修订']);
    assert.equal(actions[0].title, '发调价通知');
    assert.equal(actions[0].detail, '周五涨5%');
    assert.equal(actions[1].taskId, 3);
    assert.equal(actions[1].version, 2);
    assert.equal(actions[2].taskId, 4);
    assert.equal(actions[3].taskId, 5);
    assert.equal(actions[3].title, '改后');
    assert.equal(stripped, '正文');
  });

  it('收尾变体/未闭合/英文冒号都认,无块文本不动', () => {
    const v = parseActionBlocks('好\n【确认】\n任务:7\n版本:1\n【/确认】');
    assert.equal(v.actions[0].taskId, 7);
    assert.equal(v.stripped, '好');
    const u = parseActionBlocks('行\n【取消】\n任务：8');
    assert.equal(u.actions[0].type, '取消');
    assert.equal(u.actions[0].taskId, 8);
    assert.equal(u.stripped, '行');
    const plain = parseActionBlocks('纯聊天，无动作');
    assert.deepEqual(plain.actions, []);
    assert.equal(plain.stripped, '纯聊天，无动作');
  });
});

describe('applyDialogueActions 执行', () => {
  const db = new DatabaseSync(join(mkdtempSync(join(tmpdir(), 'dimspace-actions-')), 'a.db'));
  db.exec(TASKS_DDL);
  const PID = 1;

  it('提议建单 proposed/v1;确认成功静默翻 confirmed', () => {
    const r1 = applyDialogueActions(db, PID, '方案如下\n【提议】\n标题：上新\n内容：先上3款\n【提议结束】');
    assert.deepEqual(r1.notes, []);
    assert.equal(r1.text, '方案如下');
    const tasks = listTasks(db, PID);
    assert.equal(tasks.length, 1);
    const tid = tasks[0].id;
    const r2 = applyDialogueActions(db, PID, `好\n【确认】\n任务：${tid}\n版本：1\n【确认结束】`);
    assert.deepEqual(r2.notes, []);
    assert.equal(getTask(db, PID, tid).status, 'confirmed');
  });

  it('过期确认给诚实提示;同回复自确认被拦下', () => {
    const t = createTask(db, PID, { title: '待修订案', detail: '' });
    db.prepare('UPDATE tasks SET proposal_version = 2 WHERE id = ?').run(t.id);
    const stale = applyDialogueActions(db, PID, `确认\n【确认】\n任务：${t.id}\n版本：1\n【确认结束】`);
    assert.equal(stale.notes.length, 1);
    assert.match(stale.notes[0], /第1版/);
    assert.match(stale.notes[0], /第2版/);
    assert.equal(getTask(db, PID, t.id).status, 'proposed');
    const missing = applyDialogueActions(db, PID, '确认\n【确认】\n任务：99999\n版本：1\n【确认结束】');
    assert.match(missing.notes[0], /找不到了/);
    // 自确认:同一回复里提议新任务并立刻确认它,必须被拦(新任务保持 proposed)
    const nextId = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM tasks').get().n;
    const self = applyDialogueActions(db, PID,
      `新方案\n【提议】\n标题：自批\n【提议结束】\n【确认】\n任务：${nextId}\n版本：1\n【确认结束】`);
    assert.equal(self.notes.length, 1);
    assert.match(self.notes[0], /亲口确认/);
    assert.equal(self.text, '新方案');
    assert.equal(getTask(db, PID, nextId).status, 'proposed');
  });

  it('取消静默;修订成功静默+版本+1;修订已确认给提示', () => {
    const t = createTask(db, PID, { title: '可取消', detail: '' });
    const c = applyDialogueActions(db, PID, `算了\n【取消】\n任务：${t.id}\n【取消结束】`);
    assert.deepEqual(c.notes, []);
    assert.equal(getTask(db, PID, t.id).status, 'cancelled');
    const r = createTask(db, PID, { title: '可修订', detail: '旧' });
    const r1 = applyDialogueActions(db, PID, `改一下\n【修订】\n任务：${r.id}\n内容：新\n【修订结束】`);
    assert.deepEqual(r1.notes, []);
    assert.equal(getTask(db, PID, r.id).proposal_version, 2);
    assert.equal(getTask(db, PID, r.id).detail, '新');
    const done = createTask(db, PID, { title: '已定案', detail: '' });
    db.prepare("UPDATE tasks SET status = 'confirmed' WHERE id = ?").run(done.id);
    const r2 = applyDialogueActions(db, PID, `再改\n【修订】\n任务：${done.id}\n内容：想改\n【修订结束】`);
    assert.equal(r2.notes.length, 1);
    assert.match(r2.notes[0], /已确认，不能再改/);
  });
});
