import { describe, expect, it } from 'vitest';
import { MockWorkbenchClient } from './mock-workbench-client';
import { defaultProjectAvatar } from '../assets/project-avatars';

const input = (overrides = {}) => ({ name: '', workingFolder: null, initialMessage: '', attachments: [], templateEnabled: false, industryIntelligenceEnabled: true, ...overrides });

describe('MockWorkbenchClient createProject', () => {
  it('uses folder then date names, keeps date names unique, and preserves the first user message context', async () => {
    const client = new MockWorkbenchClient();
    const fromFolder = await client.createProject(input({ workingFolder: { displayName: '研究资料', mockRef: 'browser-folder:研究资料' } }));
    expect(fromFolder.conversation.title).toBe('研究资料');
    const first = await client.createProject(input({ initialMessage: '整理项目范围', attachments: [{ id: 'brief', displayName: 'brief.md', mimeType: 'text/markdown', size: 12 }] }));
    const second = await client.createProject(input());
    const base = new Date().toISOString().slice(0, 10);
    expect(first.conversation.title).toBe(base);
    expect(second.conversation.title).toBe(`${base} 02`);
    expect(first.initialMessage).toMatchObject({ author: 'user', text: '整理项目范围', attachments: [{ displayName: 'brief.md' }] });
  });

  it('阶段流转:咨询->收集->确认->执行->暂停/继续->完成', async () => {
    const client = new MockWorkbenchClient();
    const project = await client.createProject(input({ name: '白茶店' }));
    expect(project.project.phase).toBe('consulting');
    expect(project.messages[0].text).toMatch('AI产品经理');
    const ask = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '你能做什么？', modelId: 'chatgpt' });
    expect(ask.project?.phase).toBe('consulting');
    expect(ask.message.text).toMatch('将交付');
    const intent = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '卖茶叶', modelId: 'chatgpt' });
    expect(intent.project?.phase).toBe('collecting');
    expect(intent.message.text).toMatch('正在整理需求');
    for (const text of ['云南白茶', '99元', '白领']) {
      await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text, modelId: 'chatgpt' });
    }
    const confirming = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '淘宝', modelId: 'chatgpt' });
    expect(confirming.project?.phase).toBe('confirming');
    expect(confirming.message.text).toMatch('我理解您的需求是');
    expect(confirming.project?.profile).toBeUndefined(); // 确认前不保存
    const corrected = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '价格改成199元', modelId: 'chatgpt' });
    expect(corrected.message.text).toMatch('已更新:价格 → 199元');
    const step1 = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '确认', modelId: 'chatgpt' });
    expect(step1.project?.phase).toBe('executing');
    expect(step1.message.text).toMatch('1/3 项目档案已生成');
    expect(step1.project?.profile).toMatchObject({ price: '199元' });
    const paused = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '暂停', modelId: 'chatgpt' });
    expect(paused.project?.phase).toBe('paused');
    const step2 = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '继续', modelId: 'chatgpt' });
    expect(step2.message.text).toMatch('2/3 执行计划已生成');
    const final = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '继续', modelId: 'chatgpt' });
    expect(final.project?.phase).toBe('done');
    expect(final.message.text).toMatch('执行完成');
  });

  it('keeps an uploaded avatar when one is supplied at creation', async () => {
    const client = new MockWorkbenchClient();
    const avatar = { source: 'upload' as const, name: 'avatar.png', mimeType: 'image/png', size: 6, dataUrl: 'data:image/png;base64,YXZhdGFy' };
    const project = await client.createProject(input({ avatar }));
    expect(project.project.avatar).toEqual(avatar);
  });
});

describe('MockWorkbenchClient.updateProjectProfile', () => {
  it('内存更新资料并返回', async () => {
    const client = new MockWorkbenchClient();
    const profile = { productName: '白茶', category: '茶叶', price: '99', specs: '500g', sellingPoints: '香', notes: '' };
    const updated = await client.updateProjectProfile({ projectId: 'project-launch', profile });
    expect(updated.profile).toEqual(profile);
    await expect(client.updateProjectProfile({ projectId: '不存在', profile })).rejects.toThrow('项目不存在');
  });
});
