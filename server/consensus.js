// 项目记忆 v2:后台自动记,用户零操作。
// 流程:提取(模型标记块/用户推测规则) -> 自动入库 facts/decisions -> 同主题冲突自动过期旧条目(进 history)。
// 确认环节已取消;保障改为:低置信度标记 + 过期历史 + 摘要复核 + 口头/按钮纠正。
// 旧版 suggestions/openQuestions 数组保留读取兼容,不再写入。
export const CONSENSUS_VERSION = 2;

export function defaultConsensus() {
  return { version: CONSENSUS_VERSION, goal: null, facts: [], suggestions: [], openQuestions: [], decisions: [], history: [] };
}

const clip = (value, length) => String(value ?? '').trim().slice(0, length);
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36).padStart(3, '0')}`;
const now = () => new Date().toISOString();

// 从模型回复中提取【标记块】。返回 {items, stripped}:
// items = 条目文本(最多5条,每条最多100字);stripped = 去掉整块后的展示文本(静默,不留附注)。
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

// 用户推测检测:"也许/可能"类自动入库但标低置信度(摘要里提示可能不准)。
// kind=decision(涉及钱/拍板)进决定区,否则进事实区。
const GUESS_MARKERS = /(也许|可能|大概|或者|说不定|没准|考虑|想试试|试试看)/;
const DECISION_HINTS = /(预算|钱|元|块|买|定|选|方案|投入|囤货|代发|开店|辞职|全职)/;
export function detectUserGuess(userText) {
  if (!GUESS_MARKERS.test(String(userText ?? ''))) return null;
  return { kind: DECISION_HINTS.test(userText) ? 'decision' : 'fact' };
}
export const guessDecision = (text) => DECISION_HINTS.test(String(text ?? ''));

// 主题键:同主题新条目自动过期旧条目(要求3:以最新对话为准,不问用户)。
const TOPICS = [
  ['budget', /(预算|钱|元|块|投入|资金|费用|成本|花|价格|定价)/],
  ['channel', /(平台|渠道|淘宝|天猫|京东|拼多多|抖音|快手|小红书|视频号|亚马逊|独立站|上架到|在哪卖|哪里卖)/],
  ['customer', /(客户|顾客|人群|对象|目标|用户|买家|粉丝)/],
  ['product', /(商品|产品|货|品类|茶叶|茶|服装|衣服|美妆|数码|食品|零食|卖什么|做什么)/],
];
export function topicKey(text) {
  const hit = TOPICS.find(([, pattern]) => pattern.test(String(text ?? '')));
  return hit ? hit[0] : null;
}

export function makeItem({ text, kind, origin, messageId, confidence = 'high', status }) {
  return {
    id: newId(),
    text: clip(text, 120),
    kind, // fact | decision
    origin, // user-guess | ai
    confidence, // high | low(用户推测)
    status: status ?? (kind === 'decision' ? 'decided' : 'confirmed'),
    source: { messageId: messageId ?? null },
    updatedAt: now(),
  };
}

// 自动入库:相同文本跳过(去重);同主题不同文本则旧条目过期进 history,新条目入库。
// 返回 'duplicate' | 'added' | 'updated'。
export function saveRemembered(consensus, item) {
  for (const list of [consensus.facts, consensus.decisions]) {
    if (list.some((entry) => entry.text === item.text)) return 'duplicate';
  }
  const key = topicKey(item.text);
  let updated = false;
  if (key) {
    for (const list of [consensus.facts, consensus.decisions]) {
      const index = list.findIndex((entry) => entry.text !== item.text && topicKey(entry.text) === key);
      if (index !== -1) {
        const [old] = list.splice(index, 1);
        consensus.history.push({ ...old, status: 'expired', expiredAt: now(), replacedBy: item.id });
        while (consensus.history.length > 100) consensus.history.shift();
        updated = true;
        break;
      }
    }
  }
  (item.kind === 'decision' ? consensus.decisions : consensus.facts).push(item);
  return updated ? 'updated' : 'added';
}

// 纠正:找到条目则旧版过期、新版入库(保留 kind/status);找不到返回 ok:false。
export function applyCorrect(consensus, id, text) {
  const clean = clip(text, 120);
  if (!clean) return { ok: false, error: '纠正内容不能为空' };
  for (const list of [consensus.facts, consensus.decisions]) {
    const index = list.findIndex((entry) => entry.id === id);
    if (index !== -1) {
      const [old] = list.splice(index, 1);
      const item = { ...old, id: newId(), text: clean, confidence: 'high', updatedAt: now(), correctedFrom: old.id };
      consensus.history.push({ ...old, status: 'expired', expiredAt: now(), replacedBy: item.id });
      list.push(item);
      return { ok: true, consensus };
    }
  }
  return { ok: false, error: '没有这条记忆' };
}

// 记忆摘要(确定性组装,无模型调用,供后续前端快捷键入口调用)。
// remembered = 全部;uncertain = 低置信度(来自用户推测,可能不准)。
export function buildSummary(consensus) {
  const remembered = [...consensus.facts, ...consensus.decisions];
  const uncertain = remembered.filter((item) => item.confidence === 'low');
  const text = remembered.length === 0
    ? '目前还没有记住任何信息。'
    : `目前记住了${remembered.length}条:\n${remembered.map((item) => `·${item.text}`).join('\n')}${
      uncertain.length ? `\n其中${uncertain.length}条来自你的推测、可能不准,可直接口头纠正。` : ''
    }`;
  return { text, remembered, uncertain };
}
