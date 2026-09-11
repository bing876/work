import { useState } from 'react';
import type { Project, Task } from '../client/workbench-client';
import './project-office.css';

type Props = { project: Project; tasks: Task[]; onReturn: () => void };
const statusLabel = { queued: '等待依赖', running: '执行中', completed: '已完成' };
const roles = ['需求分析员', '任务执行员', '交付整理员'];

/** Frontend-only visualization: tasks stand in for roles until agent telemetry is available. */
export function ProjectOffice({ project, tasks, onReturn }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'activity' | 'conversation'>('activity');
  const selected = tasks.find(task => task.id === selectedId);
  const completed = tasks.filter(task => task.status === 'completed').length;
  return <section className="project-office" aria-label={`${project.name}的数字办公室`}>
    <header className="office-header"><div><span className="office-eyebrow">AI WORKSPACE / 项目办公室</span><h1>{project.name}</h1><p>看见协作，专注下一步。</p></div><button type="button" onClick={onReturn}>返回项目会话 ↗</button></header>
    <div className="office-demo-note">前端演示 · 角色由当前项目任务映射，并非真实在线智能体；位置与记录用于演示。</div>
    <div className="office-stats" aria-label="项目状态概览">
      <div><span>演示角色</span><strong>{tasks.length.toString().padStart(2, '0')}</strong></div>
      <div><span>执行中</span><strong>{tasks.filter(task => task.status === 'running').length.toString().padStart(2, '0')}<i className="office-live-dot" /></strong></div>
      <div><span>等待依赖</span><strong>{tasks.filter(task => task.status === 'queued').length.toString().padStart(2, '0')}</strong></div>
      <div><span>任务完成</span><strong>{completed}<small> / {tasks.length}</small></strong></div>
    </div>
    <div className={`office-body ${selected ? 'with-detail' : ''}`}>
      <section className="office-map" aria-label="办公室平面图">
        <div className="office-map-heading"><span>工作区 / FLOOR 01</span><span>点击角色查看详情</span></div>
        <div className="office-workstations">
          {tasks.map((task, index) => <button type="button" key={task.id} className={`office-station ${task.status}`} aria-label={`查看${roles[index % roles.length]}：${task.title}`} aria-pressed={selectedId === task.id} onClick={() => { setSelectedId(task.id); setTab('activity'); }}>
            <span className="office-desk" aria-hidden="true"><span className="office-monitor" /><span className="office-keyboard" /></span>
            <span className="office-person" aria-hidden="true"><span /><i /></span>
            <span className="office-role">{roles[index % roles.length]}</span><span className="office-task">{task.title}</span><span className="office-status">{statusLabel[task.status]}</span>
          </button>)}
          {!tasks.length && <p className="office-empty">办公室已就绪，等待项目任务。你可以返回项目会话补充需求。</p>}
        </div>
        <div className="office-shared-area" aria-hidden="true"><span className="office-plant">✳</span><div className="office-meeting-table"><i /><i /><span>协作区</span><i /><i /></div><span className="office-lounge">结果交接区</span></div>
        <footer className="office-map-legend"><span>● 执行中</span><span>● 等待依赖</span><span>✓ 已完成</span></footer>
      </section>
      {selected && <aside className="office-detail" aria-label="智能体详情">
        <header><span>演示角色详情</span><button type="button" aria-label="关闭智能体详情" onClick={() => setSelectedId(null)}>×</button></header>
        <div className="office-detail-avatar" aria-hidden="true">AI</div><h2>{roles[tasks.indexOf(selected) % roles.length]}</h2><span className={`office-detail-status ${selected.status}`}>{statusLabel[selected.status]}</span>
        <div className="office-detail-tabs" role="tablist" aria-label="智能体详情视图"><button id="office-activity-tab" aria-controls="office-detail-panel" role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>执行流程</button><button id="office-conversation-tab" aria-controls="office-detail-panel" role="tab" aria-selected={tab === 'conversation'} onClick={() => setTab('conversation')}>会话空间</button></div>
        <div id="office-detail-panel" role="tabpanel" aria-labelledby={`office-${tab}-tab`}>
          {tab === 'activity' ? <><h3>当前任务</h3><p>{selected.title}</p><p className="office-muted">{selected.detail}</p><ol className="office-steps"><li>接收项目任务</li><li>{selected.status === 'queued' ? '等待前置任务完成' : '处理任务与整理结果'}</li><li>{selected.status === 'completed' ? '任务已完成' : '等待交付结果'}</li></ol><p className="office-muted">流程示意 · 尚未接入实时工具调用与事件记录。</p></> : <><h3>独立会话空间</h3><p className="office-muted">这里将展示该智能体的会话上下文，不与项目主会话混用。</p><div className="office-demo-message"><small>模拟记录 · 非真实消息</small><p>我负责「{selected.title}」。当前状态：{statusLabel[selected.status]}。</p></div><p className="office-muted">智能体会话接口接入后开放交流。目前可返回项目主会话补充需求。</p><button className="office-return" type="button" onClick={onReturn}>打开项目会话 ↗</button></>}
        </div>
      </aside>}
    </div>
    <footer className="office-summary"><span>项目进度</span><progress aria-label="任务完成进度" max={Math.max(tasks.length, 1)} value={completed} /><span>{completed} / {tasks.length} 项任务已完成</span></footer>
  </section>;
}
