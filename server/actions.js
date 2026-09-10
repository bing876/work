// 步骤5:对话动作协议。模型用【提议/确认/取消/修订】块表达动作,后端执行并剥离显示。
// 理解归模型(不写关键词正则猜用户意图),执行归后端(版本号+幂等保安全)。
import { cancelTask, confirmTask, createTask, reviseTask } from './tasks.js';

const ACTION_TYPES = ['提议', '确认', '取消', '修订'];
const endTags = (type) => [`【${type}结束】`, `【/${type}】`, `【${type}/】`];
const firstInt = (text) => {
  const m = String(text ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
};
// 取“标题：xxx”类字段值,兼容中英文冒号
const field = (lines, name) => {
  const line = lines.find((l) => l.startsWith(name));
  if (!line) return '';
  return line.slice(name.length).replace(/^[:：\s]+/, '').trim();
};
const parseBlock = (type, inner) => {
  const lines = inner.split('\n').map((l) => l.trim()).filter(Boolean);
  const action = { type, taskId: null, version: null, title: '', detail: '' };
  if (type === '提议') {
    action.title = field(lines, '标题').slice(0, 200);
    action.detail = (field(lines, '内容') || field(lines, '详情')).slice(0, 2000);
  } else if (type === '确认') {
    action.taskId = firstInt(field(lines, '任务') || lines.join(' '));
    action.version = firstInt(field(lines, '版本'));
  } else if (type === '取消') {
    action.taskId = firstInt(field(lines, '任务') || lines.join(' '));
  } else if (type === '修订') {
    action.taskId = firstInt(field(lines, '任务'));
    action.version = firstInt(field(lines, '版本'));
    action.title = field(lines, '标题').slice(0, 200);
    action.detail = (field(lines, '内容') || field(lines, '详情')).slice(0, 2000);
  }
  return action;
};

// 解析全部动作块:循环找最早出现的起始标记,配最近的自有收尾;未闭合截到末尾。块一律剥掉。
export function parseActionBlocks(replyText) {
  let remaining = String(replyText ?? '');
  const actions = [];
  for (;;) {
    let hit = null;
    for (const type of ACTION_TYPES) {
      const i = remaining.indexOf(`【${type}】`);
      if (i !== -1 && (!hit || i < hit.index)) hit = { type, index: i };
    }
    if (!hit) break;
    const startLen = `【${hit.type}】`.length;
    let end = -1;
    let endLen = 0;
    for (const tag of endTags(hit.type)) {
      const i = remaining.indexOf(tag, hit.index + startLen);
      if (i !== -1 && (end === -1 || i < end)) {
        end = i;
        endLen = tag.length;
      }
    }
    const inner = end === -1 ? remaining.slice(hit.index + startLen) : remaining.slice(hit.index + startLen, end);
    actions.push(parseBlock(hit.type, inner));
    remaining = (remaining.slice(0, hit.index) + (end === -1 ? '' : remaining.slice(end + endLen))).replace(/\n{3,}/g, '\n\n');
  }
  return { actions, stripped: remaining.trim() };
}

// 执行对话动作:成功静默(模型的自然语言已表达),确认/修订失败必须给用户一句诚实提示。
// 同一回复内新建的任务不许同回复确认(防 AI 自作主张)。
export function applyDialogueActions(db, projectId, replyText) {
  const { actions, stripped } = parseActionBlocks(replyText);
  const notes = [];
  const createdIds = new Set();
  for (const action of actions.slice(0, 5)) {
    if (action.type === '提议') {
      if (!action.title) continue;
      createdIds.add(createTask(db, projectId, { title: action.title, detail: action.detail }).id);
    } else if (action.type === '确认') {
      if (!action.taskId || !action.version) continue;
      if (createdIds.has(action.taskId)) {
        notes.push('（系统提示：新方案需要你亲口确认，AI 不能自己确认。请看方案后回复“确认”或提修改。）');
        continue;
      }
      const result = confirmTask(db, projectId, action.taskId, action.version);
      if (!result.ok && result.code === 'STALE') {
        notes.push(`（系统提示：你确认的是第${action.version}版，但方案已更新到第${result.currentVersion}版，本次没确认成功，请看最新版再确认。）`);
      } else if (!result.ok) {
        notes.push('（系统提示：要确认的任务找不到了，可能已被取消，本次没确认成功。）');
      }
    } else if (action.type === '取消') {
      if (!action.taskId) continue;
      cancelTask(db, projectId, action.taskId);
    } else if (action.type === '修订') {
      if (!action.taskId || (!action.title && !action.detail)) continue;
      const input = {};
      if (action.title) input.title = action.title;
      if (action.detail) input.detail = action.detail;
      const result = reviseTask(db, projectId, action.taskId, input);
      if (!result.ok && result.code === 'LOCKED') {
        notes.push('（系统提示：任务已确认，不能再改。如需改请让 AI 另建新方案。）');
      } else if (!result.ok) {
        notes.push('（系统提示：要改的任务找不到了，请让 AI 重提方案。）');
      }
    }
  }
  return { text: stripped, notes };
}
