import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateProjectDialog } from './CreateProjectDialog';

describe('创建项目弹窗(去假后:只有名称+需求)', () => {
  it('提交时只传 name + initialMessage,不再收集头像/文件夹/附件/开关', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateProjectDialog onClose={() => {}} onCreate={onCreate} />);
    expect(screen.queryByLabelText('选择项目头像')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('选择工作文件夹')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('切换模板配置')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('切换行业数据')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: '项目 Agent' } });
    fireEvent.change(screen.getByLabelText('项目需求'), { target: { value: '执行项目目标' } });
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: '项目 Agent', initialMessage: '执行项目目标' }));
  });

  it('取消与关闭都走 onClose', () => {
    const onClose = vi.fn();
    render(<CreateProjectDialog onClose={onClose} onCreate={() => Promise.resolve()} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭创建项目' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
