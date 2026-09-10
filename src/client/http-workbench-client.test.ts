import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpWorkbenchClient } from './http-workbench-client';

const row = (id: number, name: string) => ({ id, name, created_at: '2026-09-10T09:19:39.268Z' });
const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('HttpWorkbenchClient', () => {
  it('把后端项目列表装配成 WorkbenchBootstrap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, count: 1, projects: [row(1, '云南白茶')] }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await new HttpWorkbenchClient().bootstrap();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', undefined);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0]).toMatchObject({ id: 'srv-1', name: '云南白茶' });
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0]).toMatchObject({ id: 'conv-srv-1', title: '云南白茶' });
    expect(data.messages['conv-srv-1']).toEqual([]);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('创建项目时 POST 名字并返回装配好的会话', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, project: row(2, '白茶2号') }));
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
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ name: '白茶2号' });
    expect(result.project).toMatchObject({ id: 'srv-2', name: '白茶2号' });
    expect(result.initialMessage).toMatchObject({ author: 'user', text: '帮我写上架文案' });
  });

  it('空名字时用文件夹名兜底', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, project: row(3, '研究资料') }));
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
