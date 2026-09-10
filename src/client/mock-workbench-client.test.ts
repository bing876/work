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

  it('访谈5问后生成档案和计划,之后不再提问', async () => {
    const client = new MockWorkbenchClient();
    const project = await client.createProject(input({ name: '白茶店' }));
    expect(project.messages[0].text).toMatch('项目顾问');
    const answers = ['卖茶叶', '云南白茶', '白领', '99元', '淘宝'];
    let last = null;
    for (const text of answers) {
      last = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text, modelId: 'chatgpt' });
    }
    expect(last?.message.text).toMatch('访谈完成');
    expect(last?.project?.profile).toMatchObject({ productName: '云南白茶', price: '99元' });
    expect(last?.project?.plan).toMatch('执行计划');
    const extra = await client.sendMessage({ conversationId: project.conversation.id, agentId: project.agent.id, text: '再问', modelId: 'chatgpt' });
    expect(extra.message.text).toMatch('已完成');
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
