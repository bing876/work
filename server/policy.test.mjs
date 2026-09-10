// 诚实性网关单元测试:纯函数,不起服务
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectExecutionClaim, honestReply, requestTool } from './policy.js';

describe('诚实性网关', () => {
  it('普通文本和讨论原样通过,不误伤', () => {
    assert.equal(honestReply('我们讨论一下调价方案吧'), '我们讨论一下调价方案吧');
    assert.equal(honestReply('帮我写个调价通知草稿'), '帮我写个调价通知草稿');
    assert.equal(detectExecutionClaim('计划下周发布到店铺'), null);
    assert.equal(detectExecutionClaim('心态已调整为积极状态'), null);
    assert.equal(honestReply('心态已调整为积极状态'), '心态已调整为积极状态');
  });

  it('声称“已发布/已调价”被检出并追加诚实性说明', () => {
    const claimed = honestReply('我已经帮你发布到店铺了');
    assert.match(claimed, /诚实性说明/);
    assert.match(claimed, /没有店铺、支付/);
    assert.match(claimed, /需要您手动完成/);
    assert.ok(detectExecutionClaim('价格已调整为99元'));
    assert.ok(detectExecutionClaim('已支付成功'));
    assert.ok(detectExecutionClaim('已经发送给客户了'));
  });

  it('工具网关:当前无外部工具,一律明确暂不支持', () => {
    const result = requestTool('publish-to-shop');
    assert.equal(result.ok, false);
    assert.match(result.message, /暂不支持该操作/);
    assert.match(result.message, /手动完成/);
  });
});
