import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpWorkbenchClient } from './http-workbench-client';

const row = (id: number, name: string) => ({ id, name, created_at: '2026-09-10T09:19:39.268Z', profile: null, plan: null });
const msg = (id: number, author: string, text: string) => ({ id, author, text, created_at: '2026-09-10T09:19:39.268Z' });
const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('HttpWorkbenchClient', () => {
  it('把后端项目列表装配成 WorkbenchBootstrap', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/projects') return Promise.resolve(jsonResponse({ ok: true, count: 1, projects: [row(1, '云南白茶')] }));
      if (url === '/api/projects/1/messages') {
        return Promise.resolve(jsonResponse({ ok: true, messages: [msg(1, 'assistant', '您好！我是您的项目顾问')] }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const data = await new HttpWorkbenchClient().bootstrap();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', undefined);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]).toMatchObject({ id: 'srv-1', name: '云南白茶' });
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0]).toMatchObject({ id: 'conv-srv-1', title: '云南白茶' });
    expect(data.messages['conv-srv-1']).toHaveLength(1);
    expect(data.messages['conv-srv-1'][0]).toMatchObject({ id: 'srv-msg-1', author: 'assistant' });
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('创建项目时 POST 名字并返回装配好的会话', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      project: row(2, '白茶2号'),
      messages: [msg(1, 'assistant', '您好！'), msg(2, 'user', '帮我写上架文案'), msg(3, 'assistant', '第2问')],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new HttpWorkbenchClient().createProject({
      name: '  白茶2号 ',
      workingFolder: null,
      initialMessage: '帮我写上架文案',
      attachments: [],
      templateEnabled: false,
      industryIntelligenceEnabled: true,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ name: '白茶2号', initialMessage: '帮我写上架文案' });
    expect(result.project).toMatchObject({ id: 'srv-2', name: '白茶2号' });
    expect(result.messages).toHaveLength(3);
    expect(result.initialMessage).toMatchObject({ author: 'user', text: '帮我写上架文案' });
  });

  it('空名字时用文件夹名兜底', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, project: row(3, '研究资料'), messages: [msg(1, 'assistant', '您好！')] }));
    vi.stubGlobal('fetch', fetchMock);
    await new HttpWorkbenchClient().createProject({
      name: '   ',
      workingFolder: { displayName: '研究资料', mockRef: 'browser-folder:研究资料' },
      initialMessage: '',
      attachments: [],
      templateEnabled: false,
      industryIntelligenceEnabled: true,
    });
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ name: '研究资料' });
  });

  it('后端报错或连不上时抛出人话错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: 'name 不能为空' }, 400)));
    await expect(new HttpWorkbenchClient().bootstrap()).rejects.toThrow('name 不能为空');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(new HttpWorkbenchClient().bootstrap()).rejects.toThrow('连不上后端服务');
  });
});

describe('HttpWorkbenchClient.updateProjectProfile', () => {
  const profile = { productName: '云南白茶', category: '茶叶', price: '99元', specs: '500g', sellingPoints: '高山', notes: '' };

  it('PUT 资料并返回后端项目', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, project: { ...row(1, '云南白茶'), profile } }));
    vi.stubGlobal('fetch', fetchMock);
    const updated = await new HttpWorkbenchClient().updateProjectProfile({ projectId: 'srv-1', profile });
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/1', expect.objectContaining({ method: 'PUT' }));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ profile });
    expect(updated).toMatchObject({ id: 'srv-1', profile });
  });

  it('非后端项目 id 直接拒绝,不发请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new HttpWorkbenchClient().updateProjectProfile({ projectId: 'mock-project-1', profile })).rejects.toThrow('不是后端项目');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('HttpWorkbenchClient.sendMessage', () => {
  it('走访谈接口,未完成时只返回回复', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, reply: { text: '第2问' }, done: false, project: null }));
    vi.stubGlobal('fetch', fetchMock);
    const turn = await new HttpWorkbenchClient().sendMessage({ conversationId: 'conv-srv-1', agentId: 'srv-1', text: '卖茶叶', modelId: 'chatgpt' });
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/1/chat', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ text: '卖茶叶' });
    expect(turn.message).toMatchObject({ author: 'assistant', text: '第2问' });
    expect(turn.project).toBeUndefined();
  });

  it('访谈完成时附带更新后的项目', async () => {
    const profile = { productName: '白茶', category: '茶', price: '99', specs: '', sellingPoints: '', notes: '' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true, reply: { text: '访谈完成！' }, done: true,
      project: { id: 1, name: '白茶店', created_at: '2026-09-10T09:19:39.268Z', profile, plan: '【执行计划】' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const turn = await new HttpWorkbenchClient().sendMessage({ conversationId: 'conv-srv-1', agentId: 'srv-1', text: '淘宝', modelId: 'chatgpt' });
    expect(turn.project).toMatchObject({ id: 'srv-1', profile, plan: '【执行计划】' });
  });

  it('非后端会话直接拒绝', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new HttpWorkbenchClient().sendMessage({ conversationId: 'conv-x', agentId: 'x', text: 'hi', modelId: 'chatgpt' })).rejects.toThrow('不是后端会话');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
