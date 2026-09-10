import type { ShellState } from './shell-types';
import { avatarFor, projectConversations, railItems } from './shell-assets';

type Props = {
  state: ShellState;
  update: (patch: Partial<ShellState>) => void;
  onToggleSwitcher: () => void;
  showTabs: boolean;
  showSwitcher: boolean;
};

export function Rail({ state, update, onToggleSwitcher, showTabs, showSwitcher }: Props) {
  return (
    <nav className="rail" aria-label="主导航">
      <button className="menu-btn" type="button" aria-label={state.collapsed ? '退出 Agent Switcher' : '进入 Agent Switcher'} aria-pressed={state.collapsed} onClick={onToggleSwitcher}>
        <span className="rail-user-avatar">{state.data.user.initials}</span>
      </button>
      {showTabs && <div className="rail-tabs" aria-hidden={state.collapsed}>
        {railItems.map(([label, asset, selectedAsset], index) => (
          <button key={label} className={`tab tab-${['msg', 'contact', 'fav', 'file', 'moments'][index]} ${index === 0 ? 'selected' : ''}`} type="button" aria-label={label} tabIndex={state.collapsed ? -1 : 0}>
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
  );
}
