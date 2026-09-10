import { ArrowClockwise, Copy, PencilSimple } from '@phosphor-icons/react';
import type { AgentSummary, Artifact, Message, Project, Task } from '../client/workbench-client';
import { avatars } from './shell-assets';

export function Conversation({ messages, agent, project, tasks, artifacts }: { messages: Message[]; agent?: AgentSummary; project?: Project; tasks: Task[]; artifacts: Artifact[] }) {
  if (!messages.length) return <section className="chat-area empty-conversation" aria-label="空白对话" />;
  return <section className="chat-area" aria-label="对话">
    {project && <ProjectExperience project={project} tasks={tasks} artifacts={artifacts} />}
    {messages.map((message) => <MessageView key={message.id} message={message} agent={agent} />)}
  </section>;
}

function ProjectExperience({ project, tasks, artifacts }: { project: Project; tasks: Task[]; artifacts: Artifact[] }) {
  const status = project.status === 'completed' ? '已完成' : project.status === 'planning' ? '规划中' : '执行中';
  const taskStatus = (value: Task['status']) => value === 'completed' ? '已完成' : value === 'running' ? '执行中' : '待执行';
  return <section className="project-experience" aria-label="项目执行状态">
    <header><span><b>{project.template === 'launch' ? '新品发布工作流' : '项目工作流'}</b><small>{project.name}</small></span><em data-state={project.status}>{status}</em></header>
    <div className="experience-section"><strong>任务执行</strong>{tasks.map((task) => <div className="task-row" key={task.id}><span><b>{task.title}</b><small>{task.detail}</small></span><em data-state={task.status}>{taskStatus(task.status)}</em></div>)}</div>
    <div className="experience-section"><strong>文件结果</strong>{artifacts.map((artifact) => <div className="artifact-row" key={artifact.id} data-ready={artifact.status === 'ready'}><span><b>{artifact.name}</b><small>{artifact.kind} · {artifact.summary}</small></span><em>{artifact.status === 'ready' ? '已就绪' : '生成中'}</em></div>)}</div>
  </section>;
}

function MessageView({ message, agent }: { message: Message; agent?: AgentSummary }) {
  const mine = message.author === 'user';
  return <article className={`message ${mine ? 'user' : 'assistant'}`}>
    {!mine && <img className="message-avatar" src={avatars[Math.max(0, agent ? 0 : 1)]} alt="" />}
    <div className="message-content">
      {!mine && <strong className="message-sender">{agent?.name ?? 'XYZ'}</strong>}
      <p className="message-bubble">{message.text}</p>
      {!!message.attachments?.length && <div className="message-attachments">{message.attachments.map((attachment) => <span key={attachment.id}>{attachment.displayName}</span>)}</div>}
      {mine && <div className="user-msg-actions"><button aria-label="复制消息" type="button"><Copy size={15} /></button><button aria-label="编辑消息" type="button"><PencilSimple size={15} /></button></div>}
      {!mine && <div className="assistant-actions"><button aria-label="复制结果" type="button"><Copy size={15} /></button><button aria-label="重新生成" type="button"><ArrowClockwise size={15} /></button></div>}
    </div>
  </article>;
}
