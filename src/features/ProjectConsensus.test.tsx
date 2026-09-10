import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectConsensus } from './ProjectConsensus';
import type { Consensus, WorkbenchClient } from '../client/workbench-client';

const item = (id: string, text: string) => ({
  id, text, kind: 'fact' as const, origin: 'ai' as const, confidence: 'high' as const,
  status: 'confirmed' as const, source: { messageId: 1 }, updatedAt: '2026-09-10T00:00:00.000Z',
});
const consensus: Consensus = {
  version: 2, goal: null, suggestions: [], openQuestions: [], history: [],
  facts: [item('f1', '主做茶叶')],
  decisions: [{ ...item('d1', '预算两万'), kind: 'decision', status: 'decided' }],
};
const client = (next: Consensus) => ({ correctConsensus: vi.fn().mockResolvedValue(next) }) as unknown as WorkbenchClient;

describe('ProjectConsensus', () => {
  it('只读展示:无确认按钮,条目与日期可见', () => {
    render(<ProjectConsensus projectId="srv-1" consensus={consensus} client={client(consensus)} onUpdate={() => {}} />);
    expect(screen.getByRole('button', { name: /项目档案（已记住2条）/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /项目档案/ }));
    expect(screen.getByText('主做茶叶')).toBeInTheDocument();
    expect(screen.getByText('预算两万')).toBeInTheDocument();
    expect(screen.queryByText(/确认/)).not.toBeInTheDocument();
    expect(screen.queryByText(/待确认/)).not.toBeInTheDocument();
  });

  it('纠正流程:点纠正改字保存,调接口并回写', async () => {
    const next: Consensus = { ...consensus, decisions: [{ ...consensus.decisions[0], id: 'd2', text: '预算一万' }] };
    const stub = client(next);
    const onUpdate = vi.fn();
    render(<ProjectConsensus projectId="srv-1" consensus={consensus} client={stub} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /项目档案/ }));
    fireEvent.click(screen.getByRole('button', { name: '纠正：预算两万' }));
    const input = screen.getByRole('textbox', { name: '纠正内容' });
    fireEvent.change(input, { target: { value: '预算一万' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await vi.waitFor(() => expect(stub.correctConsensus).toHaveBeenCalledWith({ projectId: 'srv-1', id: 'd1', text: '预算一万' }));
    expect(onUpdate).toHaveBeenCalledWith('srv-1', next);
  });
});
