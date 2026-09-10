// 任务3:商品资料面板。显示在工作区顶部,6个字段可编辑保存。
// 父组件切换项目时靠 key={project.id} 重置表单。
import { useState } from 'react';
import type { ProductProfile, Project, WorkbenchClient } from '../client/workbench-client';

const FIELDS: { key: keyof ProductProfile; label: string; multiline?: boolean }[] = [
  { key: 'productName', label: '商品名' },
  { key: 'category', label: '类目' },
  { key: 'price', label: '价格' },
  { key: 'specs', label: '规格' },
  { key: 'sellingPoints', label: '卖点', multiline: true },
  { key: 'notes', label: '备注', multiline: true },
];

const EMPTY: ProductProfile = { productName: '', category: '', price: '', specs: '', sellingPoints: '', notes: '' };

type Props = { project: Project; client: WorkbenchClient; onSaved: (project: Project) => void };

export function ProductProfileCard({ project, client, onSaved }: Props) {
  const [draft, setDraft] = useState<ProductProfile>({ ...EMPTY, ...project.profile });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await client.updateProjectProfile({ projectId: project.id, profile: draft });
      // 后端不存头像,把当前头像合并回来,避免保存后头像被重置
      onSaved({ ...updated, avatar: project.avatar });
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-profile" aria-label="商品资料">
      <header>
        <span>
          <b>商品资料</b>
          <small>{project.name}</small>
        </span>
        {savedAt ? <em className="saved">已保存 {savedAt}</em> : <em>未保存</em>}
      </header>
      <div className="profile-grid">
        {FIELDS.map((field) => (
          <label key={`profile-${field.key}`}>
            <span>{field.label}</span>
            {field.multiline ? (
              <textarea
                aria-label={field.label}
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                rows={2}
              />
            ) : (
              <input
                aria-label={field.label}
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      {error && <p className="profile-error" role="alert">保存失败:{error}</p>}
      <footer>
        <button type="button" className="primary" disabled={saving} onClick={() => void save()}>
          {saving ? '保存中…' : '保存资料'}
        </button>
      </footer>
    </section>
  );
}
