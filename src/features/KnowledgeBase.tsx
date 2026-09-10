import { useState } from 'react';
import type { Consensus, ConsensusItem, WorkbenchClient } from '../client/workbench-client';

type Props = { projectId: string | undefined; consensus: Consensus | undefined; client: WorkbenchClient; onUpdate: (projectId: string, consensus: Consensus) => void };

// 知识库（第一列「收藏」进入）：本项目记忆只读 + 纠正；文件与成果后续接入。
export function KnowledgeBase({ projectId, consensus, client, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const startEdit = (item: ConsensusItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };
  const save = async (item: ConsensusItem) => {
    if (!projectId) return;
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
  const facts = consensus?.facts ?? [];
  const decisions = consensus?.decisions ?? [];
  const total = facts.length + decisions.length;
  return <section className="knowledge-base" aria-label="知识库">
    <h3 className="kb-title">知识库{total > 0 ? `（已记住${total}条）` : ''}</h3>
    {!projectId || !consensus || total === 0 ? <p className="kb-empty">暂无记忆。和 AI 多聊，重要的事它会自动记住。</p>
      : <>
          <KbGroup label="关键信息" items={facts} editingId={editingId} editText={editText} busy={busy} onEdit={startEdit} onChange={setEditText} onSave={save} onCancel={() => setEditingId(null)} />
          <KbGroup label="已定事项" items={decisions} editingId={editingId} editText={editText} busy={busy} onEdit={startEdit} onChange={setEditText} onSave={save} onCancel={() => setEditingId(null)} />
        </>}
    <div className="kb-files" aria-label="文件与成果">
      <h4>文件与成果</h4>
      <p className="kb-empty">暂无。后续上传的文件和生成的成果会在这里。</p>
    </div>
  </section>;
}

type GroupProps = {
  label: string; items: ConsensusItem[]; editingId: string | null; editText: string; busy: boolean;
  onEdit: (item: ConsensusItem) => void; onChange: (value: string) => void;
  onSave: (item: ConsensusItem) => void; onCancel: () => void;
};

function KbGroup({ label, items, editingId, editText, busy, onEdit, onChange, onSave, onCancel }: GroupProps) {
  if (items.length === 0) return null;
  return <div className="kb-group" aria-label={label}>
    <h4>{label}（{items.length}）</h4>
    <ul>{items.map((item) => <li key={item.id}>
      {editingId === item.id
        ? <span className="kb-edit">
            <input aria-label="纠正内容" value={editText} disabled={busy} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void onSave(item); if (event.key === 'Escape') onCancel(); }} />
            <button type="button" disabled={busy} onClick={() => void onSave(item)}>保存</button>
            <button type="button" disabled={busy} onClick={onCancel}>取消</button>
          </span>
        : <>
            <span>{item.text}</span>
            <button type="button" className="kb-correct" aria-label={`纠正：${item.text}`} onClick={() => onEdit(item)}>纠正</button>
          </>}
    </li>)}</ul>
  </div>;
}
