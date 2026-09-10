import { useState } from 'react';
import type { Consensus, ConsensusItem, WorkbenchClient } from '../client/workbench-client';

type Props = { projectId: string; consensus: Consensus | undefined; client: WorkbenchClient; onUpdate: (projectId: string, consensus: Consensus) => void };

const originLabel = (item: ConsensusItem) => (item.origin === 'user-guess' ? '用户推测' : 'AI建议');

export function ProjectConsensus({ projectId, consensus, client, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!consensus) return null;
  const pending = consensus.suggestions.length + consensus.openQuestions.length;
  const confirm = async (item: ConsensusItem, as: 'fact' | 'decision') => {
    setBusyId(item.id);
    try {
      onUpdate(projectId, await client.confirmConsensus({ projectId, id: item.id, as }));
    } finally {
      setBusyId(null);
    }
  };
  return <section className="project-consensus" aria-label="项目共识">
    <button type="button" className="consensus-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      项目共识{pending > 0 ? `（${pending}条待确认）` : '（无待确认）'}
    </button>
    {open && <div className="consensus-body">
      <div className="consensus-group" aria-label="已确认事实">
        <h4>已确认事实（{consensus.facts.length}）</h4>
        {consensus.facts.length === 0 ? <p className="consensus-empty">暂无</p>
          : <ul>{consensus.facts.map((item) => <li key={item.id}><span>{item.text}</span></li>)}</ul>}
      </div>
      <div className="consensus-group" aria-label="已做决定">
        <h4>已做决定（{consensus.decisions.length}）</h4>
        {consensus.decisions.length === 0 ? <p className="consensus-empty">暂无</p>
          : <ul>{consensus.decisions.map((item) => <li key={item.id}><span>{item.text}</span></li>)}</ul>}
      </div>
      <PendingGroup label="AI建议" items={consensus.suggestions} busyId={busyId} onConfirm={confirm} />
      <PendingGroup label="待确认事项" items={consensus.openQuestions} busyId={busyId} onConfirm={confirm} />
      <p className="consensus-hint">建议区内容需你确认后才会生效；数据保存在后端，刷新不丢失。</p>
    </div>}
  </section>;
}

function PendingGroup({ label, items, busyId, onConfirm }: { label: string; items: ConsensusItem[]; busyId: string | null; onConfirm: (item: ConsensusItem, as: 'fact' | 'decision') => void }) {
  return <div className="consensus-group" aria-label={label}>
    <h4>{label}（{items.length}）</h4>
    {items.length === 0 ? <p className="consensus-empty">暂无</p>
      : <ul>{items.map((item) => <li key={item.id}>
        <span>{item.text}</span>
        <i className="consensus-origin">{originLabel(item)}</i>
        <button type="button" disabled={busyId === item.id} onClick={() => void onConfirm(item, 'fact')}>确认为事实</button>
        <button type="button" disabled={busyId === item.id} onClick={() => void onConfirm(item, 'decision')}>确认为决定</button>
      </li>)}</ul>}
  </div>;
}
