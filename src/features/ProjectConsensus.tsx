import { useState } from 'react';
import type { Consensus, ConsensusItem, WorkbenchClient } from '../client/workbench-client';

type Props = { projectId: string; consensus: Consensus | undefined; client: WorkbenchClient; onUpdate: (projectId: string, consensus: Consensus) => void };

// 记忆 v2:只读档案。AI 后台自动记,用户只看;觉得不对点悬停出现的[纠正]直接改。
export function ProjectConsensus({ projectId, consensus, client, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!consensus) return null;
  const total = consensus.facts.length + consensus.decisions.length;
  const startEdit = (item: ConsensusItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };
  const save = async (item: ConsensusItem) => {
    if (!editText.trim() || editText.trim() === item.text) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      onUpdate(projectId, await client.correctConsensus({ projectId, id: item.id, text: editText.trim() }));
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };
  return <section className="project-consensus" aria-label="项目档案">
    <button type="button" className="consensus-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      项目档案{total > 0 ? `（已记住${total}条）` : '（暂无记忆）'}
    </button>
    {open && <div className="consensus-body">
      <ReadGroup label="关键信息" items={consensus.facts} editingId={editingId} editText={editText} busy={busy} onEdit={startEdit} onChange={setEditText} onSave={save} onCancel={() => setEditingId(null)} />
      <ReadGroup label="已定事项" items={consensus.decisions} editingId={editingId} editText={editText} busy={busy} onEdit={startEdit} onChange={setEditText} onSave={save} onCancel={() => setEditingId(null)} />
    </div>}
  </section>;
}

type GroupProps = {
  label: string; items: ConsensusItem[]; editingId: string | null; editText: string; busy: boolean;
  onEdit: (item: ConsensusItem) => void; onChange: (value: string) => void;
  onSave: (item: ConsensusItem) => void; onCancel: () => void;
};

function ReadGroup({ label, items, editingId, editText, busy, onEdit, onChange, onSave, onCancel }: GroupProps) {
  return <div className="consensus-group" aria-label={label}>
    <h4>{label}（{items.length}）</h4>
    {items.length === 0 ? <p className="consensus-empty">暂无</p>
      : <ul>{items.map((item) => <li key={item.id}>
        {editingId === item.id
          ? <span className="consensus-edit">
              <input aria-label="纠正内容" value={editText} disabled={busy} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void onSave(item); if (event.key === 'Escape') onCancel(); }} />
              <button type="button" disabled={busy} onClick={() => void onSave(item)}>保存</button>
              <button type="button" disabled={busy} onClick={onCancel}>取消</button>
            </span>
          : <>
              <span>{item.text}</span>
              <time className="consensus-date">{item.updatedAt.slice(0, 10)}</time>
              <button type="button" className="consensus-correct" aria-label={`纠正：${item.text}`} onClick={() => onEdit(item)}>纠正</button>
            </>}
      </li>)}</ul>}
  </div>;
}
