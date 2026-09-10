// 任务3调整版:项目档案展示(只读)。访谈中显示进度,访谈完成后显示档案+执行计划。
// 档案由访谈自动整理,用户不再手动填表。
import type { Project } from '../client/workbench-client';

const TOTAL = 5;
const ROWS: { key: 'productName' | 'category' | 'price' | 'specs' | 'sellingPoints' | 'notes'; label: string }[] = [
  { key: 'productName', label: '商品' },
  { key: 'category', label: '类目' },
  { key: 'price', label: '价格' },
  { key: 'specs', label: '规格' },
  { key: 'sellingPoints', label: '卖点' },
  { key: 'notes', label: '备注' },
];

export function ProjectDossier({ project, userAnswerCount }: { project: Project; userAnswerCount: number }) {
  const done = project.profile != null;
  return (
    <section className="project-dossier" aria-label="项目档案">
      <header>
        <span>
          <b>项目档案</b>
          <small>{project.name}</small>
        </span>
        {done ? <em className="done">引导完成</em> : <em>引导中…已了解 {Math.min(userAnswerCount, TOTAL)}/{TOTAL}</em>}
      </header>
      {done && project.profile ? (
        <>
          <dl className="dossier-grid">
            {ROWS.map((row) => (
              <div key={`dossier-${row.key}`}>
                <dt>{row.label}</dt>
                <dd>{project.profile?.[row.key] || '—'}</dd>
              </div>
            ))}
          </dl>
          {project.plan && (
            <div className="dossier-plan">
              <strong>执行计划</strong>
              <pre>{project.plan}</pre>
            </div>
          )}
        </>
      ) : (
        <p className="dossier-hint">AI产品经理正在了解您的需求，请在下方对话框回答，信息齐了就自动生成档案、计划和文案初稿。</p>
      )}
    </section>
  );
}
