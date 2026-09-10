import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  X,
} from '@phosphor-icons/react';
import type { AgentSummary, Consensus, ConversationSummary, Message, ModelOption, Project, RailSection, WorkbenchBootstrap, WorkbenchClient } from '../client/workbench-client';
import avatar1 from '../assets/prototype/avatar-1.png';
import avatar2 from '../assets/prototype/avatar-2.png';
import avatar3 from '../assets/prototype/avatar-3.png';
import avatar4 from '../assets/prototype/avatar-4.png';
import { getToken, getUser, logout } from '../client/auth';
import avatar5 from '../assets/prototype/avatar-5.png';
import avatar6 from '../assets/prototype/avatar-6.png';
import railContacts from '../assets/prototype/rail-contact.png';
import railFav from '../assets/prototype/rail-fav.png';
import railFiles from '../assets/prototype/rail-file.png';
import railMoments from '../assets/prototype/rail-moments.png';
import railMessages from '../assets/prototype/rail-msg.png';
import railMessagesOn from '../assets/prototype/rail-msg-on.png';
import searchIcon from '../assets/prototype/icon-search.svg';
import sendIcon from '../assets/prototype/icon-send.svg';
import tokenRing from '../assets/prototype/icon-token-ring.svg';
import { projectAvatarAsset } from '../assets/project-avatars';
import { CreateProjectDialog } from './CreateProjectDialog';
import { KnowledgeBase } from './KnowledgeBase';
import type { CreateProjectInput } from '../client/workbench-client';

type ShellState = { data: WorkbenchBootstrap; section: RailSection; conversationId: string; search: string; searchFocused: boolean; sidebarWidth: number; collapsed: boolean; createProjectDialogOpen: boolean; settingsOpen: boolean; };
type Action = { type: 'set'; patch: Partial<ShellState> } | { type: 'append'; conversationId: string; message: Message } | { type: 'agent-turn'; result: import('../client/workbench-client').AgentTurn } | { type: 'consensus'; projectId: string; consensus: Consensus };
type Props = { state: ShellState; dispatch: React.Dispatch<Action>; client: WorkbenchClient; selectedConversation: ConversationSummary | null; onCreateProject: (input: CreateProjectInput) => Promise<void> };

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
const railItems = [
  ['消息', railMessages, railMessagesOn],
  ['联系人', railContacts],
  ['收藏', railFav],
  ['文件', railFiles],
  ['朋友圈', railMoments],
] as const;
const railSections = ['conversations', 'contacts', 'saved', 'files', 'moments'] as const;
const sectionLabels: Record<RailSection, string> = { conversations: '消息', contacts: '联系人', saved: '收藏', files: '文件', moments: '朋友圈' };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function AppShell({ state, dispatch, client, selectedConversation, onCreateProject }: Props) {
  const frameRef = useRef<HTMLElement>(null);
  const modeTimerRef = useRef<number | null>(null);
  const [modeTransition, setModeTransition] = useState<'entering' | 'leaving' | null>(null);
  const sidebarWidth = clamp(state.sidebarWidth, 250, 310);
  const update = (patch: Partial<ShellState>) => dispatch({ type: 'set', patch });
  const conversation = selectedConversation;
  const agent = state.data.agents.find((item) => item.id === conversation?.agentId) ?? state.data.agents[0];
  const project = state.data.projects.find((item) => item.conversationId === conversation?.id);
  const selectedModel = state.data.models.find((item) => item.id === state.data.selectedModelId) ?? state.data.models[0];

  useEffect(() => () => {
    if (modeTimerRef.current !== null) window.clearTimeout(modeTimerRef.current);
  }, []);

  function setSwitcher(open: boolean) {
    if (modeTimerRef.current !== null) window.clearTimeout(modeTimerRef.current);
    setModeTransition(open ? 'entering' : 'leaving');
    update({ collapsed: open });
    modeTimerRef.current = window.setTimeout(() => setModeTransition(null), open ? 480 : 620);
  }

  function resizeSidebar(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== undefined && event.button !== 0) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointers have no active capture */ }
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let resizing = true;
    const end = () => {
      resizing = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    const move = (moveEvent: PointerEvent) => {
      if (!resizing) return;
      const nextWidth = Math.round(startWidth + moveEvent.clientX - startX);
      if (nextWidth <= 140) {
        end();
        setSwitcher(true);
        return;
      }
      update({ sidebarWidth: clamp(nextWidth, 250, 310) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function resizeSidebarByKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 1 : 10;
    const next = event.key === 'ArrowLeft' ? sidebarWidth - step
      : event.key === 'ArrowRight' ? sidebarWidth + step
      : event.key === 'Home' ? 250
      : event.key === 'End' ? 310
      : null;
    if (next === null) return;
    event.preventDefault();
    update({ sidebarWidth: clamp(next, 250, 310) });
  }

  const showSwitcher = state.collapsed || modeTransition === 'leaving';
  const showTabs = !state.collapsed || modeTransition === 'entering';

  return (
    <main className="workbench-stage" data-testid="workbench-stage">
      <section
        ref={frameRef}
        className={`frame ${state.collapsed ? 'collapsed agent' : ''} ${modeTransition ?? ''} ${modeTransition ? 'animating' : ''}`}
        style={{ '--sidebar-width': `${state.collapsed ? 0 : sidebarWidth}px` } as React.CSSProperties}
        aria-label="XYZ Workbench vNext"
      >
        <nav className="rail" aria-label="主导航">
          <button className="menu-btn" type="button" aria-label={state.collapsed ? '退出 Agent Switcher' : '进入 Agent Switcher'} aria-pressed={state.collapsed} onClick={() => setSwitcher(!state.collapsed)}>
            <span className="rail-user-avatar">{state.data.user.initials}</span>
          </button>
          {showTabs && <div className="rail-tabs" aria-hidden={state.collapsed}>
            {railItems.map(([label, asset, selectedAsset], index) => (
              <button key={label} className={`tab tab-${['msg', 'contact', 'fav', 'file', 'moments'][index]} ${state.section === railSections[index] ? 'selected' : ''}`} type="button" aria-label={label} aria-pressed={state.section === railSections[index]} tabIndex={state.collapsed ? -1 : 0} onClick={() => update({ section: railSections[index] })}>
                <img className="tab-icon-off" src={asset} alt="" />
                {selectedAsset && <img className="tab-icon-on" src={selectedAsset} alt="" />}
              </button>
            ))}
          </div>}
          {showSwitcher && <div className="rail-agent-list" aria-label="项目与智能体" aria-hidden={!state.collapsed}>
            {projectConversations(state.data).map(({ project, conversation: target }) => {
              const selected = target.id === state.conversationId;
              return <button key={project.id} type="button" className={`rail-agent-avatar ${selected ? 'selected' : ''}`} aria-label={project.name} aria-pressed={selected} tabIndex={state.collapsed ? 0 : -1} onClick={() => update({ conversationId: target.id })}><img src={avatarFor(project.avatar)} alt="" /></button>;
            })}
            <button className="rail-quick-add" type="button" aria-label="创建项目" tabIndex={state.collapsed ? 0 : -1} onClick={() => update({ createProjectDialogOpen: true })}><span className="primitive-plus" aria-hidden="true" /></button>
          </div>}
          {!state.collapsed && <button className="hamburger-btn" type="button" aria-label="设置" onClick={() => update({ settingsOpen: true })}><span /><span /><span /></button>}
        </nav>

        <aside className="sidebar" aria-label="上下文和会话">
          {state.section === 'saved' ? <KnowledgeBase projectId={project?.id} consensus={project ? state.data.consensus[project.id] : undefined} client={client} onUpdate={(projectId, consensus) => dispatch({ type: 'consensus', projectId, consensus })} />
          : state.section !== 'conversations' ? <div className="sidebar-placeholder">「{sectionLabels[state.section]}」建设中</div>
          : <><div className="sidebar-tools">
            <label className="search-pill" data-state={searchState(state.search, state.searchFocused)}>
              <img className="search-icon" src={searchIcon} alt="" />
              <input aria-label="搜索项目" value={state.search} onFocus={() => update({ searchFocused: true })} onBlur={() => update({ searchFocused: false })} onChange={(event) => update({ search: event.target.value })} placeholder="搜索" />
              {state.search && <button className="search-clear" type="button" aria-label="清空搜索" onMouseDown={(event) => event.preventDefault()} onClick={() => update({ search: '' })} />}
            </label>
            <button className="add-btn" type="button" aria-label="创建项目" onClick={() => update({ createProjectDialogOpen: true })}><span className="primitive-plus" aria-hidden="true" /></button>
          </div>
          <div className="contact-list">
            {projectConversations(state.data).filter(({ project, conversation }) => matchSearch(state.search, project, conversation)).map(({ project, conversation }) => {
              const thread = state.data.messages[conversation.id] ?? [];
              const preview = thread.length ? thread[thread.length - 1].text.slice(0, 30) : conversation.preview;
              return <ContactRow key={project.id} conversation={conversation} preview={preview} avatar={avatarFor(project.avatar)} selected={conversation.id === state.conversationId} onClick={() => update({ conversationId: conversation.id })} />;
            })}
          </div></>}
        </aside>
        <div className="splitter" role="separator" tabIndex={state.collapsed ? -1 : 0} aria-hidden={state.collapsed} aria-orientation="vertical" aria-label="调整侧边栏宽度" aria-valuemin={250} aria-valuemax={310} aria-valuenow={sidebarWidth} onPointerDown={resizeSidebar} onKeyDown={resizeSidebarByKeyboard} onDoubleClick={() => update({ sidebarWidth: 250 })} />

        <section className="main-area" aria-label="工作区">
          <Conversation messages={state.data.messages[state.conversationId] ?? []} agent={agent} />
          <Composer state={state} dispatch={dispatch} client={client} conversation={conversation} selectedModel={selectedModel} />
        </section>
        {state.createProjectDialogOpen && <CreateProjectDialog onClose={() => update({ createProjectDialogOpen: false })} onCreate={onCreateProject} />}
      </section>
      {state.settingsOpen && <SettingsDialog onClose={() => update({ settingsOpen: false })} />}
    </main>
  );
}

function projectConversations(data: WorkbenchBootstrap) {
  return data.projects.flatMap((project) => {
    const conversation = data.conversations.find((item) => item.id === project.conversationId);
    return conversation ? [{ project, conversation }] : [];
  });
}
function avatarFor(avatar: Project['avatar']) {
  return avatar.source === 'upload' ? avatar.dataUrl : projectAvatarAsset(avatar.id);
}
function searchState(search: string, focused: boolean) { return focused ? (search ? 'typing' : 'focused') : (search ? 'filled' : 'default'); }
function matchSearch(query: string, project: Project, conversation: ConversationSummary) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return project.name.toLowerCase().includes(q) || conversation.title.toLowerCase().includes(q) || conversation.preview.toLowerCase().includes(q);
}

const AVATAR_PALETTE = ['#edf1f7', '#eff5d6', '#fff0e9', '#fff4d3', '#dff8f4', '#e1f4fb'];
function avatarPlate(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function ContactRow({ conversation, preview, avatar, selected, onClick }: { conversation: ConversationSummary; preview: string; avatar: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`contact-item ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>
    <img className="contact-avatar" src={avatar} alt="" style={{ '--avatar-plate': avatarPlate(conversation.id) } as React.CSSProperties} />
    <span className="contact-body"><span className="contact-line"><strong>{conversation.title}</strong><time>{conversation.updatedAt}</time></span><span className="contact-preview">{preview}</span></span>
  </button>;
}

function Conversation({ messages, agent }: { messages: Message[]; agent?: AgentSummary }) {
  if (!messages.length) return <section className="chat-area empty-conversation" aria-label="空白对话" />;
  return <section className="chat-area" aria-label="对话">
    {messages.map((message) => <MessageView key={message.id} message={message} agent={agent} />)}
  </section>;
}

function MessageView({ message, agent }: { message: Message; agent?: AgentSummary }) {
  const mine = message.author === 'user';
  const [copied, setCopied] = useState(false);
  const copyLabel = mine ? '复制消息' : '复制结果';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
    } catch {
      /* 剪贴板不可用(如非安全上下文) */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return <article className={`message ${mine ? 'user' : 'assistant'}`}>
    {!mine && <img className="message-avatar" src={avatars[Math.max(0, agent ? 0 : 1)]} alt="" />}
    <div className="message-content">
      {!mine && <strong className="message-sender">{agent?.name ?? 'XYZ'}</strong>}
      <p className="message-bubble">{message.text}</p>
      {!!message.attachments?.length && <div className="message-attachments">{message.attachments.map((attachment) => <span key={attachment.id}>{attachment.displayName}</span>)}</div>}
      <div className={mine ? 'user-msg-actions' : 'assistant-actions'}><button aria-label={copied ? '已复制' : copyLabel} type="button" onClick={() => void copy()}><Copy size={15} /></button></div>
    </div>
  </article>;
}

function Composer({ state, dispatch, client, conversation, selectedModel }: { state: ShellState; dispatch: React.Dispatch<Action>; client: WorkbenchClient; conversation: ConversationSummary | null; selectedModel?: ModelOption }) {
  const [draft, setDraft] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const lastText = useRef('');
  const update = (patch: Partial<ShellState>) => dispatch({ type: 'set', patch });
  const send = async (content: string, optimistic: boolean) => {
    if (!content.trim() || !conversation) return;
    lastText.current = content;
    if (optimistic) {
      const local: Message = { id: `local-${Date.now()}`, author: 'user', agentId: conversation.agentId, text: content };
      dispatch({ type: 'append', conversationId: conversation.id, message: local });
      setDraft('');
    }
    setFailure(null);
    try {
      const reply = await client.sendMessage({ conversationId: conversation.id, agentId: conversation.agentId, text: content, modelId: state.data.selectedModelId });
      dispatch({ type: 'agent-turn', result: reply });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : '发送失败，请重试');
    }
  };
  return <footer className="composer" aria-label="消息输入">
    {failure && <div className="composer-error" role="alert"><span>{failure}</span><button type="button" onClick={() => void send(lastText.current, false)}>重试</button></div>}
    <div className="inputbar">
      <textarea aria-label="输入消息" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft, true); } }} placeholder="比如：我想在淘宝卖茶叶" rows={1} />
      <button className="inputbar-btn send" type="button" aria-label="发送消息" onClick={() => void send(draft, true)}><img src={sendIcon} alt="" /></button>
    </div>
    <div className="token-outside">
      <div className="model-wrap">
        <span className="token token-static" role="img" aria-label={`当前模型:${selectedModel?.name ?? '未知'}`} title={selectedModel?.name ?? '未知模型'}><img className="token-ring" src={tokenRing} alt="" /><span className="token-letter" aria-hidden="true">{(selectedModel?.name ?? '?').slice(0, 1).toUpperCase()}</span></span>
      </div>
      <button className="circle-plus" type="button" aria-label="工作区设置" onClick={() => update({ settingsOpen: true })}><span className="primitive-plus plugin-plus" aria-hidden="true" /></button>
    </div>
  </footer>;
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [pane, setPane] = useState('账号');
  const me = getToken() ? getUser() : null;
  return <dialog className="settings-modal" open aria-label="设置"><section className="settings-card"><aside><h2>设置</h2>{['账号', '关于'].map((item) => <button key={item} className={pane === item ? 'selected' : ''} onClick={() => setPane(item)} type="button">{item}</button>)}</aside><main><button className="settings-close" type="button" aria-label="关闭设置" onClick={onClose}><X size={20} /></button><h3>{pane}</h3>{pane === '账号' ? <>{me ? <p className="settings-account">手机号:{me.phone} / 坐标号:{me.coordinateId}</p> : <p>本地预览模式,未登录。</p>}{getToken() && <button className="settings-logout" type="button" onClick={logout}>退出登录</button>}</> : <p>DIMSPACE 零度之上 · AI 项目负责人工作台。模型、记忆与任务确认由后端服务提供。</p>}</main></section></dialog>;
}
