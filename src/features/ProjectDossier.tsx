// 项目档案(只读):阶段徽标 + 渐进展示(档案->计划) + 每阶段一句话示例,降低认知负担。
import type { Message, Project, ProjectPhase } from '../client/workbench-client';

const TOTAL = 5;
const ROWS: { key: 'productName' | 'category' | 'price' | 'specs' | 'sellingPoints' | 'notes'; label: string }[] = [
  { key: 'productName', label: '商品' },
  { key: 'category', label: '类目' },
  { key: 'price', label: '价格' },
  { key: 'specs', label: '规格' },
  { key: 'sellingPoints', label: '卖点' },
  { key: 'notes', label: '备注' },
];

const EXAMPLE: Record<ProjectPhase, string | null> = {
  consulting: '「我想在淘宝卖茶叶」或「你能做什么？」',
  collecting: '直接回答上面的问题即可',
  confirming: '回复「确认」开始执行，或说「价格改成199元」来修改',
  executing: '回复「继续」下一步，「暂停」休息，或直接说调整',
  paused: '回复「继续」接着执行',
  done: null,
};

// 与后端 collectAnswers 同规则:标记前最后一条 + 标记后全部(咨询闲聊不计入)
export const countAnswers = (messages: Message[]): number => {
  let marker = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].author === 'assistant' && messages[i].text.includes('正在整理需求')) { marker = i; break; }
  }
  if (marker === -1) return 0;
  const before = messages.slice(0, marker).filter((m) => m.author === 'user');
  const after = messages.slice(marker + 1).filter((m) => m.author === 'user');
  return (before.length ? 1 : 0) + after.length;
};

const badge = (project: Project, answers: number): { text: string; done: boolean } => {
  const steps = [project.profile, project.plan, project.draft].filter(Boolean).length;
  switch (project.phase) {
    case 'consulting': return { text: '自由咨询中', done: false };
    case 'collecting': return { text: `正在整理需求…已了解 ${Math.min(answers, TOTAL)}/${TOTAL}`, done: false };
    case 'confirming': return { text: '等待确认', done: false };
    case 'executing': return { text: `执行中 ${steps}/3`, done: false };
    case 'paused': return { text: `已暂停 ${steps}/3`, done: false };
    case 'done': return { text: '引导完成', done: true };
  }
};

export function ProjectDossier({ project, messages }: { project: Project; messages: Message[] }) {
  const answers = countAnswers(messages);
  const status = badge(project, answers);
  const example = EXAMPLE[project.phase];
  return (
    <section className="project-dossier" aria-label="项目档案">
      <header>
        <span>
          <b>项目档案</b>
          <small>{project.name}</small>
        </span>
        <em className={status.done ? 'done' : ''}>{status.text}</em>
      </header>
      {project.profile ? (
        <dl className="dossier-grid">
          {ROWS.map((row) => (
            <div key={`dossier-${row.key}`}>
              <dt>{row.label}</dt>
              <dd>{project.profile?.[row.key] || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="dossier-hint">AI产品经理正在了解您的需求，请在下方对话框回答，信息齐了就进入确认，确认后分步执行。</p>
      )}
      {project.plan && (
        <div className="dossier-plan">
          <strong>执行计划</strong>
          <pre>{project.plan}</pre>
        </div>
      )}
      {example && <p className="dossier-example">您可以这样说：{example}</p>}
    </section>
  );
}
