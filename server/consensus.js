// 项目共识 v1:已确认事实 / AI建议 / 待确认事项 / 已做决定,四区隔离。
// 铁律:提取只向 suggestions/openQuestions 追加,永不碰 facts/decisions;
// 用户确认(PUT confirm)是唯一能把条目移入已确认区/已决定区的通道。
export const CONSENSUS_VERSION = 1;

export function defaultConsensus() {
  return { version: CONSENSUS_VERSION, goal: null, facts: [], suggestions: [], openQuestions: [], decisions: [] };
}

const clip = (value, length) => String(value ?? '').trim().slice(0, length);
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36).padStart(3, '0')}`;
const now = () => new Date().toISOString();

// 从模型回复中提取【标记块】(见 prompts.js 共识记录规则)。返回 {items, stripped}:
// items = 提取出的条目文本(最多5条,每条最多100字);stripped = 去掉标记块后的展示文本。
export function extractMarked(replyText, startTag, endTag) {
  const text = String(replyText ?? '');
  const start = text.indexOf(startTag);
  if (start === -1) return { items: [], stripped: text };
  const end = text.indexOf(endTag, start + startTag.length);
  if (end === -1) return { items: [], stripped: text };
  const items = text
    .slice(start + startTag.length, end)
    .split('\n')
    .map((line) => clip(line.replace(/^[\d.、\-*)\s【】]+/, ''), 100))
    .filter((line) => line && !line.includes('【'))
    .slice(0, 5);
  const stripped = (text.slice(0, start) + text.slice(end + endTag.length)).replace(/\n{3,}/g, '\n\n').trim();
  return { items, stripped };
}

// 用户推测检测:"也许/可能"类表述只进建议区(要求2)。返回 null 或 {kind}:
// kind=decision(涉及钱/拍板)确认后进已做决定区,否则进已确认事实区。
const GUESS_MARKERS = /(也许|可能|大概|或者|说不定|没准|考虑|想试试|试试看)/;
const DECISION_HINTS = /(预算|钱|元|块|买|定|选|做|方案|投入|花|囤货|代发|开店|辞职|全职)/;
export function detectUserGuess(userText) {
  if (!GUESS_MARKERS.test(String(userText ?? ''))) return null;
  return { kind: DECISION_HINTS.test(userText) ? 'decision' : 'fact' };
}

export function makeItem({ text, kind, origin, messageId }) {
  return {
    id: newId(),
    text: clip(text, 120),
    kind, // fact | decision:确认后进事实区还是决定区
    origin, // user-guess | ai:谁提出的
    status: origin === 'user-guess' ? 'suggested' : 'suggested',
    source: { messageId: messageId ?? null },
    updatedAt: now(),
  };
}

// 确认:把 suggestions/openQuestions 里的条目移入 facts/decisions。
// 已在目标区的重复确认幂等成功;未知 id 返回 ok:false。永不静默改写已有确认条目。
export function applyConfirm(consensus, id, as) {
  if (as !== 'fact' && as !== 'decision') return { ok: false, error: 'as 只能是 fact 或 decision' };
  const target = as === 'fact' ? consensus.facts : consensus.decisions;
  if (target.some((item) => item.id === id)) return { ok: true, consensus, moved: false };
  for (const from of [consensus.suggestions, consensus.openQuestions]) {
    const index = from.findIndex((item) => item.id === id);
    if (index !== -1) {
      const [item] = from.splice(index, 1);
      target.push({ ...item, status: as === 'fact' ? 'confirmed' : 'decided', confirmedAt: now(), updatedAt: now() });
      return { ok: true, consensus, moved: true };
    }
  }
  return { ok: false, error: '没有这条待确认事项' };
}

// 追加(去重+上限50,防止建议区无限膨胀)
export function appendUnique(list, item) {
  if (list.some((entry) => entry.text === item.text)) return false;
  list.push(item);
  while (list.length > 50) list.shift();
  return true;
}
