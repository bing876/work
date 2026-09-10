// 访谈剧本引擎(任务3调整版):固定流程的确定性访谈,保证无模型时也能跑通全流程。
// 任务5接真模型时,这里会被 AI 驱动替换,接口保持不变,前端不用改。
// 注意:src/client/mock-workbench-client.ts 里有一份演示用的同步副本(SCRIPT-MIRROR),改问题文案时两边一起改。

export const TOTAL_ANSWERS = 5;

export const OPENING = '您好！我是您的项目顾问，请告诉我您想做什么生意？';

export const QUESTIONS = [
  OPENING,
  '您的商品或服务具体是什么？(比如:云南白茶500g/袋)',
  '您的目标客户是谁？(比如:25-35岁办公室白领)',
  '您的价格带大概是多少？(比如:99元/500g)',
  '您主要在哪些渠道销售？(比如:淘宝、抖音、小红书)',
];

export const COMPLETED_NOTE =
  '本次访谈已完成，项目档案和执行计划已生成，见上方「项目档案」卡。完整对话能力在任务5接入，届时您可以继续追问和修改。';

const clip = (value, length) => String(value ?? '').trim().slice(0, length);

// userCount = 用户已回答条数(1..4 返回下一问,>=5 不再提问)
export const replyFor = (userCount) =>
  userCount >= 1 && userCount <= QUESTIONS.length - 1 ? QUESTIONS[userCount] : COMPLETED_NOTE;

// 机械映射(临时):把5条回答填进档案字段,任务5换成 AI 提取
export function compileProfile(answers) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = answers;
  return {
    productName: clip(a2, 30),
    category: clip(a1, 20),
    price: clip(a4, 30),
    specs: '',
    sellingPoints: '',
    notes: clip(`访谈整理:生意「${a1}」;商品「${a2}」;客户「${a3}」;价格「${a4}」;渠道「${a5}」`, 500),
  };
}

// 模板计划(临时):任务5换成 AI 定制
export function compilePlan(answers) {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = answers;
  return [
    '【执行计划】(访谈初版,任务5将升级为 AI 定制版)',
    `一、定位:围绕「${clip(a1, 30)}」,首批聚焦「${clip(a3, 30)}」客户。`,
    `二、商品:上架「${clip(a2, 30)}」,价格带「${clip(a4, 30)}」。`,
    `三、渠道:优先铺设「${clip(a5, 40)}」。`,
    '四、下一步:完善商品卖点与详情文案(任务4:成果编辑)。',
  ].join('\n');
}

export function finalMessage(profile) {
  return [
    '访谈完成！已为您整理出项目档案和执行计划：',
    `商品:${profile.productName || '—'}｜类目:${profile.category || '—'}｜价格:${profile.price || '—'}`,
    '完整档案见上方「项目档案」卡。',
  ].join('\n');
}
