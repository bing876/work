import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectOffice } from './ProjectOffice';
import { MockWorkbenchClient } from '../client/mock-workbench-client';

describe('ProjectOffice', () => {
  it('shows project-scoped task roles and explicitly simulated conversations', async () => {
    const data = await new MockWorkbenchClient().bootstrap();
    const onReturn = vi.fn();
    render(<ProjectOffice project={data.projects[0]} tasks={data.tasks} onReturn={onReturn} />);
    expect(screen.getByRole('region', { name: '春季新品发布的数字办公室' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看任务执行员：建立内容与渠道策略' }));
    expect(screen.getByLabelText('智能体详情')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '执行流程' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: '会话空间' }));
    expect(screen.getByText('模拟记录 · 非真实消息')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开项目会话 ↗' }));
    expect(onReturn).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '关闭智能体详情' }));
    expect(screen.queryByLabelText('智能体详情')).not.toBeInTheDocument();
  });
  it('handles a project without tasks', async () => {
    const data = await new MockWorkbenchClient().bootstrap();
    render(<ProjectOffice project={data.projects[0]} tasks={[]} onReturn={vi.fn()} />);
    expect(screen.getByText(/办公室已就绪，等待项目任务/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
  });
});
