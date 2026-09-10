import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { WorkbenchClientProvider } from './workbench-context';
import { MockWorkbenchClient } from '../client/mock-workbench-client';
import type { WorkbenchClient } from '../client/workbench-client';

describe('Phase 0.7 project rail and sidebar', () => {
  it('switches the selected project between Rail and Sidebar and exposes source search and creation states', async () => {
    render(<WorkbenchClientProvider client={new MockWorkbenchClient()}><App /></WorkbenchClientProvider>);
    expect((await screen.findAllByText('春季新品发布')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '消息' }).querySelector('.tab-icon-on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /春季新品发布/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '进入 Agent Switcher' }));
    const project = screen.getByRole('button', { name: '春季新品发布' });
    expect(project).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '创建项目' }));
    expect(screen.getByRole('dialog', { name: '创建项目' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭创建项目' }));

    fireEvent.click(screen.getByRole('button', { name: '退出 Agent Switcher' }));
    expect(screen.getByRole('button', { name: /春季新品发布/ })).toHaveAttribute('aria-pressed', 'true');
    const search = screen.getByLabelText('搜索联系人');
    fireEvent.focus(search);
    expect(search.closest('.search-pill')).toHaveAttribute('data-state', 'focused');
    fireEvent.change(search, { target: { value: '春季' } });
    expect(search.closest('.search-pill')).toHaveAttribute('data-state', 'typing');
    fireEvent.change(search, { target: { value: '不存在的项目' } });
    expect(screen.getByRole('button', { name: /春季新品发布/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空搜索' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }));
    expect(search).toHaveValue('');

    fireEvent.click(within(screen.getByLabelText('上下文和会话')).getByRole('button', { name: '创建项目' }));
    expect(screen.getByRole('dialog', { name: '创建项目' })).toBeInTheDocument();
  });

  it('resizes within the source range, resets, and enters the project switcher at the collapse threshold', async () => {
    render(<WorkbenchClientProvider client={new MockWorkbenchClient()}><App /></WorkbenchClientProvider>);
    const splitter = await screen.findByRole('separator', { name: '调整侧边栏宽度' });
    expect(splitter).toHaveAttribute('aria-valuenow', '250');
    fireEvent.keyDown(splitter, { key: 'End' });
    expect(splitter).toHaveAttribute('aria-valuenow', '310');
    fireEvent.keyDown(splitter, { key: 'ArrowLeft', shiftKey: true });
    expect(splitter).toHaveAttribute('aria-valuenow', '309');
    fireEvent.doubleClick(splitter);
    expect(splitter).toHaveAttribute('aria-valuenow', '250');
    fireEvent(splitter, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 300 }));
    fireEvent(window, new MouseEvent('pointermove', { bubbles: true, clientX: 190 }));
    expect(screen.getByRole('button', { name: '退出 Agent Switcher' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '退出 Agent Switcher' }));
    expect(screen.getByRole('separator', { name: '调整侧边栏宽度' })).toHaveAttribute('aria-valuenow', '250');
  });

  it('appends newly created project avatars in creation order and keeps the newest project selected', async () => {
    render(<WorkbenchClientProvider client={new MockWorkbenchClient()}><App /></WorkbenchClientProvider>);
    await screen.findByRole('button', { name: '进入 Agent Switcher' });
    fireEvent.click(screen.getByRole('button', { name: '进入 Agent Switcher' }));

    for (const name of ['项目一', '项目二']) {
      fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '创建项目' }));
      fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: name } });
      fireEvent.click(within(screen.getByRole('dialog', { name: '创建项目' })).getByRole('button', { name: '创建项目' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '创建项目' })).not.toBeInTheDocument());
    }

    const railProjects = within(within(screen.getByRole('navigation', { name: '主导航' })).getByLabelText('项目与智能体')).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(railProjects.slice(-3)).toEqual(['项目一', '项目二', '创建项目']);
    expect(screen.getByRole('button', { name: '项目二' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '项目一' }));
    expect(screen.getByRole('button', { name: '项目一' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '退出 Agent Switcher' }));
    const sidebarProjects = within(screen.getByLabelText('上下文和会话')).getAllByRole('button').filter((button) => button.classList.contains('contact-item')).slice(-3).map((button) => button.textContent);
    expect(sidebarProjects).toEqual([expect.stringContaining('春季新品发布'), expect.stringContaining('项目一'), expect.stringContaining('项目二')]);
    expect(screen.getByRole('button', { name: /项目一/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('region', { name: '对话' })).getByText(/我是您的AI产品经理/)).toBeInTheDocument();
  });
});

describe('App 启动失败', () => {
  it('后端连不上时显示明确错误和重试按钮,而不是无限 Loading', async () => {
    const failingClient: WorkbenchClient = {
      bootstrap: () => Promise.reject(new Error('连不上后端服务,请确认后端已启动')),
      sendMessage: () => Promise.reject(new Error('not implemented')),
      createProject: () => Promise.reject(new Error('not implemented')),
      updateProjectProfile: () => Promise.reject(new Error('not implemented')),
      getConsensus: () => Promise.reject(new Error('not implemented')),
      correctConsensus: () => Promise.reject(new Error('not implemented')),
    };
    render(<WorkbenchClientProvider client={failingClient}><App /></WorkbenchClientProvider>);
    expect(await screen.findByText(/启动失败:连不上后端服务/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
