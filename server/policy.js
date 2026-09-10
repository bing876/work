// 步骤1:后端硬规则 v1(诚实性网关)。只拦"动作",不拦"话题":
// - 讨论发布/调价/支付、写草稿/通知:一律放行,不做关键词审查;
// - 实际工具调用:当前无任何外部工具,恒为"暂不支持该操作";
// - 回复声称"我已发布/已调价/已支付"(第一人称完成态,实际没干):拦截并追加诚实性说明。
// 注意:这是"验证"不是"意图理解",提示词替代不了,所以放后端。

// 外部操作动词 + 完成态补语(只匹配"干完了",不匹配"讨论/计划/草稿")
const CLAIM_PATTERNS = [
  /发布(到|成功|完成|了)/,
  /上架(成功|完成|了)/,
  /(调价|改价|价格调整)(为|到|成|完成|成功|了)/,
  /调整(价格)?(为|到|成|完成|成功|了)/, // ADJUST:裸"调整"需价格语境(见下),覆盖"价格已调整为99元"
  /(支付|付款)(成功|完成|了)/,
  /下单(成功|完成|了)/,
  /删除(成功|完成|了)/,
  /下架(成功|完成|了)/,
  /(发送|群发|推送)(成功|完成|了|给)/,
];
const PERFECTIVE = /(已|已经)[^。！？\n]{0,10}/;

export const HONESTY_NOTE =
  '【诚实性说明】我目前没有店铺、支付、消息推送等外部操作权限。上面"已完成"的表述仅指草稿/方案已准备好，实际操作需要您手动完成，或等后续接入相应工具。';

// 检测回复文本中是否"声称已完成外部动作"。返回命中的操作词,无命中返回 null。
export function detectExecutionClaim(replyText) {
  const clauses = String(replyText ?? '').split(/[。！？\n]/);
  for (const clause of clauses) {
    if (!PERFECTIVE.test(clause)) continue; // 没有"已/已经",只是讨论或计划,放行
    const hit = CLAIM_PATTERNS.find((pattern) => pattern.test(clause));
    if (!hit) continue;
    // 裸"调整"必须有价格语境,避免误伤"心态已调整为积极状态"类表达
    if (hit.source.startsWith('调整') && !/(价格|价|元|¥|折)/.test(clause)) continue;
    return hit.source;
  }
  return null;
}

// 网关:有"声称已执行"则追加诚实性说明,否则原样返回。
export function honestReply(replyText) {
  if (!detectExecutionClaim(replyText)) return String(replyText ?? '');
  return `${replyText}\n\n${HONESTY_NOTE}`;
}

// 工具网关:v1 没有任何外部工具,任何真实操作请求都明确告知暂不支持。
// 草稿/清单/步骤说明不走这里(那是正常对话,直接回答)。
export function requestTool(toolName) {
  return {
    ok: false,
    message: `暂不支持该操作：${toolName}。我可以帮您准备草稿、清单和步骤说明，实际操作需要您手动完成。`,
  };
}
