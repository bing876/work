import { useState } from 'react';
import type { CreateProjectInput } from '../client/workbench-client';

type Props = { onClose: () => void; onCreate: (input: CreateProjectInput) => Promise<void> };

// 去假:后端只收 name + initialMessage,头像/文件夹/附件/模板·行业开关一律砍掉,不再假装收集
export function CreateProjectDialog({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      await onCreate({ name: name.trim(), initialMessage: initialMessage.trim() });
    } finally {
      setCreating(false);
    }
  };

  return <dialog className="create-project-modal" open aria-label="创建项目" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <section className="create-project-card">
      <header className="create-project-head"><h2>创建项目</h2></header>
      <button className="create-project-close" type="button" aria-label="关闭创建项目" onClick={onClose} />
      <div className="project-name-shell">
        <input aria-label="项目名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="项目名称" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </div>
      <div className="project-context"><strong>需求描述</strong></div>
      <div className="project-composer">
        <textarea aria-label="项目需求" value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} placeholder="想做什么?比如:我想在淘宝卖茶叶" autoComplete="off" spellCheck={false} />
      </div>
      <footer className="create-project-footer">
        <div className="project-actions"><button type="button" onClick={onClose}>取消</button><button type="button" className="primary" disabled={creating} onClick={() => void create()}>{creating ? '创建中…' : '创建项目'}</button></div>
      </footer>
    </section>
  </dialog>;
}
