import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductProfileCard } from './ProductProfileCard';
import type { Project, WorkbenchClient } from '../client/workbench-client';

const project: Project = {
  id: 'srv-1',
  name: '云南白茶',
  agentId: 'srv-1',
  conversationId: 'conv-srv-1',
  status: 'executing',
  template: 'general',
  avatar: { source: 'library', id: 'dim-star-01' },
  profile: { productName: '云南白茶', category: '', price: '', specs: '', sellingPoints: '', notes: '' },
};

const stubClient = (updateProjectProfile: WorkbenchClient['updateProjectProfile']): WorkbenchClient => ({
  bootstrap: () => Promise.reject(new Error('not implemented')),
  sendMessage: () => Promise.reject(new Error('not implemented')),
  createProject: () => Promise.reject(new Error('not implemented')),
  updateProjectProfile,
});

describe('ProductProfileCard', () => {
  it('回显已有资料,保存时提交6个字段并保留头像', async () => {
    const updateProjectProfile = vi.fn().mockImplementation(async ({ profile }: { profile: Project['profile'] }) => ({
      ...project,
      avatar: { source: 'library', id: 'dim-star-02' }, // 模拟后端返回的默认头像
      profile,
    }));
    const onSaved = vi.fn();
    render(<ProductProfileCard project={project} client={stubClient(updateProjectProfile)} onSaved={onSaved} />);

    expect(screen.getByLabelText('商品名')).toHaveValue('云南白茶');
    fireEvent.change(screen.getByLabelText('价格'), { target: { value: '99元/500g' } });
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));

    await waitFor(() => expect(updateProjectProfile).toHaveBeenCalledWith({
      projectId: 'srv-1',
      profile: expect.objectContaining({ productName: '云南白茶', price: '99元/500g' }),
    }));
    // 头像用原来的,不用后端返回的默认头像
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      avatar: { source: 'library', id: 'dim-star-01' },
    }));
    expect(await screen.findByText(/已保存/)).toBeInTheDocument();
  });

  it('保存失败时显示人话错误,不报已保存', async () => {
    const updateProjectProfile = vi.fn().mockRejectedValue(new Error('连不上后端服务,请确认后端已启动'));
    render(<ProductProfileCard project={project} client={stubClient(updateProjectProfile)} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败:连不上后端服务');
    expect(screen.queryByText(/已保存/)).not.toBeInTheDocument();
  });
});
