import type { AgentSummary, ConversationSummary } from '../client/workbench-client';
import type { ShellState } from './shell-types';
import { avatarFor, avatarPlate, projectConversations, searchState } from './shell-assets';
import searchIcon from '../assets/prototype/icon-search.svg';

type Props = {
  state: ShellState;
  update: (patch: Partial<ShellState>) => void;
};

export function Sidebar({ state, update }: Props) {
  return (
    <aside className="sidebar" aria-label="上下文和会话">
      <div className="sidebar-tools">
        <label className="search-pill" data-state={searchState(state.search, state.searchFocused)}>
          <img className="search-icon" src={searchIcon} alt="" />
          <input aria-label="搜索联系人" value={state.search} onFocus={() => update({ searchFocused: true })} onBlur={() => update({ searchFocused: false })} onChange={(event) => update({ search: event.target.value })} placeholder="搜索" />
          {state.search && <button className="search-clear" type="button" aria-label="清空搜索" onMouseDown={(event) => event.preventDefault()} onClick={() => update({ search: '' })} />}
        </label>
        <button className="add-btn" type="button" aria-label="创建项目" onClick={() => update({ createProjectDialogOpen: true })}><span className="primitive-plus" aria-hidden="true" /></button>
      </div>
      <div className="contact-list">
        {projectConversations(state.data).map(({ project, conversation }) => (
          <ContactRow key={project.id} conversation={conversation} agent={state.data.agents.find((candidate) => candidate.id === project.agentId)} avatar={avatarFor(project.avatar)} selected={conversation.id === state.conversationId} onClick={() => update({ conversationId: conversation.id })} />
        ))}
      </div>
    </aside>
  );
}

function ContactRow({ conversation, avatar, selected, onClick }: { conversation: ConversationSummary; agent?: AgentSummary; avatar: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`contact-item ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>
    <img className="contact-avatar" src={avatar} alt="" style={{ '--avatar-plate': avatarPlate(conversation.id) } as React.CSSProperties} />
    <span className="contact-body"><span className="contact-line"><strong>{conversation.title}</strong><time>{conversation.updatedAt}</time></span><span className="contact-preview">{conversation.preview}</span></span>
  </button>;
}
