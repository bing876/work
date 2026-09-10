import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectConsensus } from './ProjectConsensus';
import type { Consensus, WorkbenchClient } from '../client/workbench-client';

const item = (id: string, text: string, origin: 'user-guess' | 'ai' = 'ai') => ({
  id, text, kind: 'fact' as const, origin, status: 'suggested' as const, source: { messageId: 1 }, updatedAt: '2026-09-10T00:00:00.000Z',
});
const consensus: Consensus = {
  version: 1, goal: null,
  facts: [item('f1', '主做茶叶')],
  suggestions: [item('s1', '先做代发试水', 'user-guess')],
  openQuestions: [item('q1', '启动资金多少')],
  decisions: [],
};
const client = (next: Consensus) => ({ confirmConsensus: vi.fn().mockResolvedValue(next) }) as unknown as WorkbenchClient;

describe('ProjectConsensus', () => {
  it('默认折叠显示待确认数,展开后四区齐全', () => {
    render(<ProjectConsensus projectId="srv-1" consensus={consensus} client={client(consensus)} onUpdate={() => {}} />);
    expect(screen.getByRole('button', { name: /项目共识（2条待确认）/ })).toBeInTheDocument();
    expect(screen.queryByText('先做代发试水')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /项目共识/ }));
    expect(screen.getByText('主做茶叶')).toBeInTheDocument();
    expect(screen.getByText('先做代发试水')).toBeInTheDocument();
    expect(screen.getByText('用户推测')).toBeInTheDocument();
    expect(screen.getByText('启动资金多少')).toBeInTheDocument();
  });

  it('点"确认为决定"调确认接口并回写新区', async () => {
    const next: Consensus = { ...consensus, suggestions: [], decisions: [{ ...consensus.suggestions[0], status: 'decided' }] };
    const stub = client(next);
    const onUpdate = vi.fn();
    render(<ProjectConsensus projectId="srv-1" consensus={consensus} client={stub} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /项目共识/ }));
    const row = screen.getByText('先做代发试水').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '确认为决定' }));
    await vi.waitFor(() => expect(stub.confirmConsensus).toHaveBeenCalledWith({ projectId: 'srv-1', id: 's1', as: 'decision' }));
    expect(onUpdate).toHaveBeenCalledWith('srv-1', next);
  });
});
