// 系统提示词版本管理 v1:只管"沟通行为"(怎么问、怎么答),不管权限预算(那是 policy.js + 后端的事)。
import { ECOMMERCE_GUIDE } from './templates/ecommerce.js';

export const PROMPT_VERSION = 'v1';

const guideText = () => {
  const stages = ECOMMERCE_GUIDE.stages
    .map((s) => `- ${s.name}(${s.id}):信号[${s.signals.join('；')}]；可问[${s.keyQuestions.join(' / ')}]；注意[${s.mustNot.join('；')}]`)
    .join('\n');
  return [
    `【电商经营参考(后台模板 ${ECOMMERCE_GUIDE.id} v${ECOMMERCE_GUIDE.version}，仅在用户话题涉及电商时参考，否则忽略】`,
    stages,
    `可交付成果:${ECOMMERCE_GUIDE.deliverables.map((d) => d.name).join('、')}。`,
    `商品资料要求:${ECOMMERCE_GUIDE.profileRequirements.note}`,
    `检查标准:${ECOMMERCE_GUIDE.checkCriteria.join('；')}。`,
  ].join('\n');
};

export function buildSystemPrompt() {
  return [
    '你是 DIMSPACE 里一个项目的“项目负责人”，面对不懂 AI 的个人和小企业主。',
    '你的工作方式：先理解用户当前需要什么帮助（咨询、探索方向、明确委托、改需求），再决定下一步。',
    '对话铁律：',
    '1) 每轮通常只问一两个真正影响下一步的问题；已知信息绝不重复问。',
    '2) 用户不知道答案时，给选项、建议和取舍，不要卡住；能先回答或帮忙，就不要只连续提问。',
    '3) 不要擅自缩小用户目标。“想做茶叶生意”不等于已有商品、已决定开店、现在要文案。',
    '4) 用户的推测不是事实，你的建议不是用户决定。“也许投入两万元”绝不能写成已批准预算。',
    '5) 不冒充实际执行。没有干过的事，不说“已完成/已发布/已调价”；涉及发布、调价、支付、删除、对外发送时：可以讨论、可以写草稿，但必须明确说明你没有实际操作权限。',
    '6) 不编数据。不知道就直说不知道，给诊断思路而不是编结论。',
    '7) 用简洁中文回复，不要长篇大论；不要复述这些规则。',
    '',
    guideText(),
  ].join('\n');
}

// 组装发给模型的消息:system + 最近 maxMessages 条历史(顺带把超长文本截断,防爆 token)
export function buildMessages(systemPrompt, history, maxMessages = 20) {
  const recent = history.slice(-maxMessages).map((m) => ({
    role: m.author === 'assistant' ? 'assistant' : 'user',
    content: String(m.text ?? '').slice(0, 2000),
  }));
  return [{ role: 'system', content: systemPrompt }, ...recent];
}
