// 引导式访谈引擎:AI产品经理边问边做,每句回复 = 复述理解 + 汇报进度 + 紧扣工作的问题。
// 答满5题后自动生成档案、执行计划和文案初稿。
// 任务5接真模型时,关键词理解和模板回复会被 AI 替换,接口保持不变,前端不用改。
// 注意:src/client/mock-workbench-client.ts 里有一份演示用的同步副本(SCRIPT-MIRROR),改文案规则时两边一起改。

export const TOTAL_ANSWERS = 5;

// 提问顺序:1生意 -> 2具体商品 -> 3价格定位 -> 4目标客户 -> 5销售渠道
export const OPENING = '您好！我是您的AI产品经理，我能为你做些什么？';

export const COMPLETED_NOTE =
  '上架文案初稿已生成(见上方对话)。完整对话和修改能力在任务5接入，届时您可以继续追问和调整。';

const clip = (value, length) => String(value ?? '').trim().slice(0, length);

// 关键词理解(临时):从第1句话判断生意类型,任务5换成 AI 理解
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

// 价格理解(临时):从价格回答里读数字,决定文案风格
export const styleForPrice = (text) => {
  const number = Number(String(text).replace(/[^0-9.]/g, '').slice(0, 10));
  if (!Number.isFinite(number) || number <= 0) return '突出核心卖点';
  if (number >= 500) return '偏向高端质感';
  if (number >= 100) return '兼顾品质与性价比';
  return '突出性价比';
};

// step = 用户已回答条数(1..4),answers = 全部用户回答(至少 step 条)
export function replyForStep(step, answers) {
  if (step === 1) {
    const found = detectIntent(answers[0]);
    if (found) return `明白了，您要做${found.intent}。我现在帮您准备上架资料，请告诉我具体是什么${found.thing}？`;
    return `明白了，我来帮您推进「${clip(answers[0], 20)}」。我现在帮您准备上架资料，请告诉我具体的商品是什么？`;
  }
  if (step === 2) {
    return `好的，${clip(answers[1], 24) || '这个商品'}。我正在为您生成商品标题和卖点，请告诉我价格定位，这样我能调整文案风格。`;
  }
  if (step === 3) {
    return `收到，${clip(answers[2], 20) || '这个价位'}。我正在按这个价位打磨文案风格（${styleForPrice(answers[2])}），请告诉我目标客户是谁，这样卖点能更对口味。`;
  }
  if (step === 4) {
    return `好的，面向${clip(answers[3], 20) || '这类客户'}。我正在把卖点往这类人群的偏好上靠，请告诉我主要在哪些渠道销售，我好按平台调文案长度和格式。`;
  }
  return COMPLETED_NOTE;
}

// 机械整理(临时):answers 顺序固定为 [生意, 商品, 价格, 客户, 渠道]
export function compileProfile(answers) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = answers;
  return {
    productName: clip(a2, 30),
    category: clip(a1, 20),
    price: clip(a3, 30),
    specs: '',
    sellingPoints: '',
    notes: clip(`需求整理:生意「${a1}」;商品「${a2}」;价格「${a3}」;客户「${a4}」;渠道「${a5}」`, 500),
  };
}

export function compilePlan(answers) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = answers;
  return [
    '【执行计划】(引导初版,任务5将升级为 AI 定制版)',
    `一、定位:围绕「${clip(a1, 30)}」,首批聚焦「${clip(a4, 30)}」客户。`,
    `二、商品:上架「${clip(a2, 30)}」,价格带「${clip(a3, 30)}」。`,
    `三、渠道:优先铺设「${clip(a5, 40)}」。`,
    '四、下一步:打磨上架文案初稿(任务4:成果编辑)。',
  ].join('\n');
}

// 文案初稿(临时模板):任务4负责展示和修改,任务5换成 AI 撰写
export function compileDraft(answers) {
  const [, a2 = '', a3 = '', a4 = '', a5 = ''] = answers;
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

export function finalMessage(profile, draft) {
  return [
    '信息收集完毕，我开始为您生成上架文案...',
    '',
    draft,
    '',
    `商品:${profile.productName || '—'}｜类目:${profile.category || '—'}｜价格:${profile.price || '—'}`,
    '档案和计划已同步到「项目档案」卡。',
  ].join('\n');
}
