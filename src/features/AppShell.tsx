import { useEffect, useRef, useState } from 'react';
import type { ConversationSummary, CreateProjectInput, WorkbenchClient } from '../client/workbench-client';
import type { Action, ShellState } from './shell-types';
import { clamp } from './shell-assets';
import { Rail } from './Rail';
import { Sidebar } from './Sidebar';
import { Conversation } from './Conversation';
import { Composer } from './Composer';
import { SettingsDialog } from './SettingsDialog';
import { CreateProjectDialog } from './CreateProjectDialog';

type Props = {
  state: ShellState;
  dispatch: React.Dispatch<Action>;
  client: WorkbenchClient;
  selectedConversation: ConversationSummary | null;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
};

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
        <Rail state={state} update={update} onToggleSwitcher={() => setSwitcher(!state.collapsed)} showTabs={showTabs} showSwitcher={showSwitcher} />

        <Sidebar state={state} update={update} />
        <div className="splitter" role="separator" tabIndex={state.collapsed ? -1 : 0} aria-hidden={state.collapsed} aria-orientation="vertical" aria-label="调整侧边栏宽度" aria-valuemin={250} aria-valuemax={310} aria-valuenow={sidebarWidth} onPointerDown={resizeSidebar} onKeyDown={resizeSidebarByKeyboard} onDoubleClick={() => update({ sidebarWidth: 250 })} />

        <section className="main-area" aria-label="工作区">
          <Conversation messages={state.data.messages[state.conversationId] ?? []} agent={agent} project={project} tasks={state.data.tasks.filter((item) => item.projectId === project?.id)} artifacts={state.data.artifacts.filter((item) => item.projectId === project?.id)} />
          <Composer state={state} dispatch={dispatch} client={client} conversation={conversation} selectedModel={selectedModel} />
        </section>
        {state.createProjectDialogOpen && <CreateProjectDialog onClose={() => update({ createProjectDialogOpen: false })} onCreate={onCreateProject} />}
      </section>
      {state.settingsOpen && <SettingsDialog onClose={() => update({ settingsOpen: false })} />}
    </main>
  );
}
