// 引导式访谈引擎(含阶段状态机)。
// 阶段:consulting(自由咨询) -> collecting(需求收集) -> confirming(确认执行)
//      -> executing(任务执行,分3步) <-> paused(已暂停) -> done(完成)
// 任务5接真模型时,关键词理解和模板回复会被 AI 替换,阶段流转和接口保持不变。
// 注意:src/client/mock-workbench-client.ts 里有一份演示用的同步副本(SCRIPT-MIRROR),改规则时两边一起改。

export const TOTAL_ANSWERS = 5;

// 提问顺序:1生意 -> 2具体商品 -> 3价格定位 -> 4目标客户 -> 5销售渠道
export const OPENING = '您好！我是您的AI产品经理，我能为你做些什么？';

export const COMPLETED_NOTE =
  '上架文案初稿已生成(见上方对话)。完整对话和修改能力在任务5接入，届时您可以继续追问和调整。';

export const CONFIRM_EXAMPLE = '回复“确认”开始执行，或说哪里要改(比如“价格改成199元”)。';

const clip = (value, length) => String(value ?? '').trim().slice(0, length);
const cleanValue = (value) => clip(value, 30).replace(/[。！？!?,，\s]+$/g, '');

// ---------- 意图与价格理解(关键词版,任务5换 AI) ----------
const INTENT_RULES = [
  [/茶/, { intent: '茶叶生意', thing: '茶叶' }],
  [/服装|衣服|女装|男装|童装|鞋|包/, { intent: '服装生意', thing: '服装' }],
  [/美妆|化妆品|护肤|口红/, { intent: '美妆生意', thing: '美妆产品' }],
  [/数码|手机|电子|耳机|电脑/, { intent: '数码生意', thing: '数码产品' }],
  [/食品|零食|水果|特产/, { intent: '食品生意', thing: '食品' }],
];
export const detectIntent = (text) => {
  const hit = INTENT_RULES.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : null;
};

export const styleForPrice = (text) => {
  const number = Number(String(text).replace(/[^0-9.]/g, '').slice(0, 10));
  if (!Number.isFinite(number) || number <= 0) return '突出核心卖点';
  if (number >= 500) return '偏向高端质感';
  if (number >= 100) return '兼顾品质与性价比';
  return '突出性价比';
};

// ---------- 能力说明模板(每个行业一份 + 通用一份) ----------
const CAPABILITY = {
  通用: {
    line: '各品类开店前的资料准备',
    can: ['陪您聊清楚要做什么(需求引导)', '整理成项目档案(商品/价格/客户/渠道)', '生成执行计划和上架文案初稿'],
    cannot: ['不能代替您开店、上架(需要您手动操作)', '不能做图、拍视频', '不能保证销量，初稿需要您把关'],
  },
  茶叶生意: {
    line: '茶叶懂行话(清香/浓香、产区、工艺)',
    can: ['陪您聊清楚要做什么(需求引导)', '整理茶叶档案(品类/产区/价格/客户)', '生成执行计划和上架文案初稿'],
    cannot: ['不能代替您开店、上架(需要您手动操作)', '不能做图、拍视频', '不能保证销量，初稿需要您把关'],
  },
  服装生意: {
    line: '服装懂尺码、面料、季节款',
    can: ['陪您聊清楚要做什么(需求引导)', '整理服装档案(品类/尺码/价格/人群)', '生成执行计划和上架文案初稿'],
    cannot: ['不能代替您开店、上架(需要您手动操作)', '不能做图、拍视频', '不能保证销量，初稿需要您把关'],
  },
  美妆生意: {
    line: '美妆懂成分、肤质、功效话术',
    can: ['陪您聊清楚要做什么(需求引导)', '整理美妆档案(品类/功效/价格/人群)', '生成执行计划和上架文案初稿'],
    cannot: ['不能代替您开店、上架(需要您手动操作)', '不能做图、拍视频', '不能保证销量，初稿需要您把关'],
  },
  数码生意: {
    line: '数码懂参数、对比、场景卖点',
    can: ['陪您聊清楚要做什么(需求引导)', '整理数码档案(品类/参数/价格/人群)', '生成执行计划和上架文案初稿'],
    cannot: ['不能代替您开店、上架(需要您手动操作)', '不能做图、拍视频', '不能保证销量，初稿需要您把关'],
  },
  食品生意: {
    line: '食品懂口味、保质期、规格话术',
    can: ['陪您聊清楚要做什么(需求引导)', '整理食品档案(品类/口味/价格/人群)', '生成执行计划和上架文案初稿'],
    cannot: ['不能代替您开店、上架(需要您手动操作)', '不能做图、拍视频', '不能保证销量，初稿需要您把关'],
  },
};

export function capabilityAnswer(intentName) {
  const cap = CAPABILITY[intentName] ?? CAPABILITY.通用;
  return [
    `我能为您做什么(${cap.line}):`,
    ...cap.can.map((item, i) => `${i + 1})${item}`),
    '我目前还不能:',
    ...cap.cannot.map((item, i) => `${i + 1})${item}`),
    '将交付:①项目档案 ②执行计划 ③上架文案初稿。',
    '如果您准备好了，直接告诉我您想做什么生意(比如“我想在淘宝卖茶叶”)，我就开始帮您整理需求。',
  ].join('\n');
}

// ---------- 用户意图识别(关键词版) ----------
export const isQuestion = (text) =>
  /[?？]|吗\s*$|怎么|什么|如何|为什么|能不能|可以不|会不会|你能|你会|多少|哪个|哪些/.test(text);
export const isConfirm = (text) =>
  /确认|同意|没问题|可以开始|开始执行|执行吧|^ *(好的|好|行|OK|ok|开始|可以) *$/.test(text.trim());
export const isContinue = (text) => /继续|下一步|往下|go/i.test(text);
export const isPause = (text) => /暂停|等一下|等等|先停|休息/.test(text);

// 纠错解析:返回 {index(0..4), value} 或 null。字段顺序固定 [生意, 商品, 价格, 客户, 渠道]
const CORRECTION_RULES = [
  [/价格|价钱|价位|定价/, 2],
  [/商品|产品|茶叶|东西|卖什么/, 1],
  [/客户|人群|对象|卖给谁/, 3],
  [/渠道|平台|哪里卖|在哪卖/, 4],
  [/生意|项目|类目|做什么/, 0],
];
export function parseCorrection(text) {
  const mark = text.match(/(改成|改为|改一下|改|换成|应该是|是|为|:|：)/);
  if (!mark || mark.index === undefined) return null;
  const before = text.slice(0, mark.index);
  const value = cleanValue(text.slice(mark.index + mark[0].length));
  if (!value) return null;
  const rule = CORRECTION_RULES.find(([pattern]) => pattern.test(before));
  if (!rule) return null;
  return { index: rule[1], value };
}

// ---------- 收集阶段回复:复述理解 + 汇报进度 + 紧扣工作的问题 ----------
export function replyForStep(step, answers) {
  if (step === 1) {
    const found = detectIntent(answers[0]);
    const direction = found ? `明白了，您要做${found.intent}。` : `明白了，我来帮您推进「${clip(answers[0], 20)}」。`;
    const question = found
      ? `我现在帮您准备上架资料，请告诉我具体是什么${found.thing}？`
      : '我现在帮您准备上架资料，请告诉我具体的商品是什么？';
    return `${direction}\n——— 正在整理需求 ———\n${question}`;
  }
  if (step === 2) {
    return `好的，${clip(answers[1], 24) || '这个商品'}。我正在为您生成商品标题和卖点，请告诉我价格定位(就是您打算卖多少钱)，这样我能调整文案风格。`;
  }
  if (step === 3) {
    return `收到，${clip(answers[2], 20) || '这个价位'}。我正在按这个价位打磨文案风格（${styleForPrice(answers[2])}），请告诉我目标客户是谁，这样卖点能更对口味。`;
  }
  if (step === 4) {
    return `好的，面向${clip(answers[3], 20) || '这类客户'}。我正在把卖点往这类人群的偏好上靠，请告诉我主要在哪些渠道销售，我好按平台调文案长度和格式。`;
  }
  return COMPLETED_NOTE;
}

// ---------- 整理(answers 顺序固定 [生意, 商品, 价格, 客户, 渠道],overrides 按下标覆盖) ----------
export const applyOverrides = (answers, overrides) => {
  const effective = answers.slice();
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < TOTAL_ANSWERS && typeof value === 'string' && value.trim()) {
      effective[index] = value;
    }
  }
  return effective;
};

export function compileProfile(answers, overrides) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = applyOverrides(answers, overrides);
  return {
    productName: clip(a2, 30),
    category: clip(a1, 20),
    price: clip(a3, 30),
    specs: '',
    sellingPoints: '',
    notes: clip(`需求整理:生意「${a1}」;商品「${a2}」;价格「${a3}」;客户「${a4}」;渠道「${a5}」`, 500),
  };
}

export function compilePlan(answers, overrides) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = applyOverrides(answers, overrides);
  return [
    '【执行计划】(引导初版,任务5将升级为 AI 定制版)',
    `一、定位:围绕「${clip(a1, 30)}」,首批聚焦「${clip(a4, 30)}」客户。`,
    `二、商品:上架「${clip(a2, 30)}」,价格带「${clip(a3, 30)}」。`,
    `三、渠道:优先铺设「${clip(a5, 40)}」。`,
    '四、下一步:打磨上架文案初稿(任务4:成果编辑)。',
  ].join('\n');
}

export function compileDraft(answers, overrides) {
  const [, a2 = '', a3 = '', a4 = '', a5 = ''] = applyOverrides(answers, overrides);
  const product = clip(a2, 24) || '本商品';
  const price = clip(a3, 20);
  const customer = clip(a4, 20) || '目标客户';
  const channel = clip(a5, 24);
  return [
    '【初版上架文案】(AI初稿,任务4可修改)',
    `标题:${product}｜${customer}优选`,
    `卖点:1)${product},精挑细选 2)${price ? `${price},${styleForPrice(a3)}` : '价格亲民'} 3)深受${customer}喜爱`,
    `详情:本款${product}专为${customer}打造${channel ? `,已上架${channel}` : ''}。`,
  ].join('\n');
}

export const FIELD_NAMES = ['生意方向', '商品', '价格', '客户', '渠道'];

// 确认阶段:需求复述 + 任务列表 + 交付预览 + 请确认
export function confirmingMessage(answers, overrides) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = applyOverrides(answers, overrides);
  return [
    `我理解您的需求是:在「${clip(a5, 24) || '待定渠道'}」卖「${clip(a2, 24) || '待定商品'}」(${clip(a1, 20) || '待定方向'})，目标客户「${clip(a4, 20) || '待定'}」，价格「${clip(a3, 20) || '待定'}」。`,
    '我准备执行以下任务:1)生成项目档案 2)生成执行计划 3)生成上架文案初稿。',
    '将交付:①项目档案 ②执行计划 ③上架文案初稿(初稿需您把关；我不能代您开店上架)。',
    `请确认开始执行。${CONFIRM_EXAMPLE}`,
  ].join('\n');
}

export function correctionMessage(fieldIndex, value, answers, overrides) {
  const effective = applyOverrides(answers, overrides);
  return [
    `已更新:${FIELD_NAMES[fieldIndex]} → ${value}。`,
    `当前需求:生意「${clip(effective[0], 20)}」；商品「${clip(effective[1], 20)}」；价格「${clip(effective[2], 20)}」；客户「${clip(effective[3], 20)}」；渠道「${clip(effective[4], 20)}」。`,
    `请确认开始执行。${CONFIRM_EXAMPLE}`,
  ].join('\n');
}

export function execProgressMessage(step) {
  const box = (n, label) => (n <= step ? `✅ ${n}/3 ${label}已生成` : `⏳ ${n}/3 ${label}待生成`);
  const lines = ['开始执行…', box(1, '项目档案'), box(2, '执行计划'), box(3, '上架文案初稿')];
  if (step < 3) lines.push('回复“继续”执行下一步，或说“暂停”。');
  return lines.join('\n');
}

export function finalMessage(profile, draft) {
  return [
    '信息收集完毕，执行完成！',
    '',
    draft,
    '',
    `商品:${profile.productName || '—'}｜类目:${profile.category || '—'}｜价格:${profile.price || '—'}`,
    '档案和计划已同步到「项目档案」卡。',
  ].join('\n');
}
