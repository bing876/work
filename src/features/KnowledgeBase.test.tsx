import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KnowledgeBase } from './KnowledgeBase';
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

describe('KnowledgeBase', () => {
  it('展示记忆分组与文件预留区,无确认按钮', () => {
    render(<KnowledgeBase projectId="srv-1" consensus={consensus} client={client(consensus)} onUpdate={() => {}} />);
    expect(screen.getByText('主做茶叶')).toBeInTheDocument();
    expect(screen.getByText('预算两万')).toBeInTheDocument();
    expect(screen.getByText('文件与成果')).toBeInTheDocument();
    expect(screen.queryByText(/确认/)).not.toBeInTheDocument();
  });

  it('无记忆时显示空态,不崩', () => {
    render(<KnowledgeBase projectId={undefined} consensus={undefined} client={client(consensus)} onUpdate={() => {}} />);
    expect(screen.getByText(/暂无记忆/)).toBeInTheDocument();
  });

  it('纠正流程:点纠正改字保存,调接口并回写', async () => {
    const next: Consensus = { ...consensus, decisions: [{ ...consensus.decisions[0], id: 'd2', text: '预算一万' }] };
    const stub = client(next);
    const onUpdate = vi.fn();
    render(<KnowledgeBase projectId="srv-1" consensus={consensus} client={stub} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: '纠正：预算两万' }));
    fireEvent.change(screen.getByRole('textbox', { name: '纠正内容' }), { target: { value: '预算一万' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await vi.waitFor(() => expect(stub.correctConsensus).toHaveBeenCalledWith({ projectId: 'srv-1', id: 'd1', text: '预算一万' }));
    expect(onUpdate).toHaveBeenCalledWith('srv-1', next);
  });
});
