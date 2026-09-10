// 步骤1过渡脚手架:明确标注"AI升级中",绝不伪装成真实AI回答。
// 只做"存档+复述+最小话题分流",不做意图理解、不追问、不下结论。
// 步骤2接真实模型后删除本文件,chat 改走 server/model.js。

export const TRANSITION_LABEL = '【AI升级中·过渡回复】';
export const TRANSITION_MODE = 'transition';

const clip = (value, length) => String(value ?? '').trim().slice(0, length);

// 用户要求的是"真实操作"还是"讨论/草稿"?
// 只有明确要"动手干"才提示权限;写草稿/通知/讨论一律正常回应(约束2:写草稿≠真实操作)。
const wantsRealOperation = (text) =>
  /(帮我|替我|给|直接).{0,8}(发布|上架|调价|改价|支付|付款|下单|删除|下架|发送|群发|推送)/.test(text) &&
  !/(草稿|通知|文案|标题|清单|怎么写|模板|示例|范文)/.test(text);

export function transitionReply(text) {
  const input = text.trim();
  // 1) 草稿/讨论类:正常给通用模板,不拦截(验收标准第3条,反误杀重点)
  if (/(草稿|通知|文案|标题|清单|怎么写|模板|示例)/.test(input)) {
    return [
      `${TRANSITION_LABEL}收到，写草稿属于正常讨论，直接给您模板：`,
      '',
      '【调价通知草稿·示例】',
      '各位顾客：本店部分商品价格将于X月X日起调整。感谢您的理解与支持！',
      '',
      '说明：完整AI正在接入中，上线后会按您的实际商品、调价幅度和语气定制终稿。',
    ].join('\n');
  }
  // 2) 真实操作类:允许讨论,但明确没有操作权限(验收标准第2条)
  if (wantsRealOperation(input) || /(发布|上架|调价|改价|支付|付款|删除|下架|发送|群发|推送)/.test(input)) {
    const topic = /(发布|上架)/.test(input) ? '发布'
      : /(调价|改价)/.test(input) ? '调价'
      : /(支付|付款|下单)/.test(input) ? '支付'
      : /(发送|群发|推送)/.test(input) ? '发送消息'
      : '该操作';
    return [
      `${TRANSITION_LABEL}我可以帮你准备和讨论${topic}事项，但我没有店铺操作权限，实际${topic}需手动完成。`,
      '您可以接着说具体情况（比如卖什么、在哪个平台），这条已存档，完整AI接入后会按您的情况给清单和草稿。',
    ].join('\n');
  }
  // 3) 默认:存档+复述,不追问、不锁死(验收标准第1条)
  return [
    `${TRANSITION_LABEL}收到，您说的是：“${clip(input, 120)}”。这条已存档到本项目。`,
    '完整理解和执行能力正在接入真实模型，上线后我会结合上下文回答和推进。您接着说即可。',
  ].join('\n');
}
