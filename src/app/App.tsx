import { useEffect, useMemo, useReducer } from 'react';
import { useWorkbenchClient } from './workbench-context';
import type { AgentTurn, Consensus, CreateProjectInput, CreateProjectResult, Message, RailSection, WorkbenchBootstrap } from '../client/workbench-client';
import { AppShell } from '../features/AppShell';

type State = { data: WorkbenchBootstrap | null; bootError: string | null; section: RailSection; conversationId: string; search: string; searchFocused: boolean; sidebarWidth: number; collapsed: boolean; createProjectDialogOpen: boolean; settingsOpen: boolean; };
type Action = { type: 'boot'; data: WorkbenchBootstrap } | { type: 'set'; patch: Partial<State> } | { type: 'append'; conversationId: string; message: Message } | { type: 'project'; result: CreateProjectResult } | { type: 'agent-turn'; result: AgentTurn } | { type: 'consensus'; projectId: string; consensus: Consensus };
const reducer = (state: State, action: Action): State => {
  if (action.type === 'boot') return { ...state, data: action.data, conversationId: action.data.conversations[0]?.id ?? '' };
  if (action.type === 'set') return { ...state, ...action.patch };
  if (action.type === 'append' && state.data) return { ...state, data: { ...state.data, messages: { ...state.data.messages, [action.conversationId]: [...(state.data.messages[action.conversationId] ?? []), action.message] } } };
  if (action.type === 'project' && state.data) {
    const { project, agent, conversation, messages, tasks, artifacts, consensus } = action.result;
    return { ...state, conversationId: conversation.id, createProjectDialogOpen: false, data: { ...state.data, projects: [...state.data.projects, project], tasks: [...state.data.tasks, ...tasks], artifacts: [...state.data.artifacts, ...artifacts], agents: [...state.data.agents, agent], conversations: [...state.data.conversations, conversation], messages: { ...state.data.messages, [conversation.id]: messages }, consensus: { ...state.data.consensus, ...(consensus ? { [project.id]: consensus } : {}) } } };
  }
  if (action.type === 'agent-turn' && state.data) {
    const { message, project, tasks, artifacts, consensus } = action.result;
    return { ...state, data: { ...state.data, projects: project ? state.data.projects.map((item) => item.id === project.id ? { ...project, avatar: item.avatar } : item) : state.data.projects, tasks: tasks ? state.data.tasks.map((item) => tasks.find((next) => next.id === item.id) ?? item) : state.data.tasks, artifacts: artifacts ? state.data.artifacts.map((item) => artifacts.find((next) => next.id === item.id) ?? item) : state.data.artifacts, consensus: consensus && project ? { ...state.data.consensus, [project.id]: consensus } : state.data.consensus, messages: { ...state.data.messages, [state.conversationId]: [...(state.data.messages[state.conversationId] ?? []), message] } } };
  }
  if (action.type === 'consensus' && state.data) return { ...state, data: { ...state.data, consensus: { ...state.data.consensus, [action.projectId]: action.consensus } } };
  return state;
};

export function App() {
  const client = useWorkbenchClient();
  const [state, dispatch] = useReducer(reducer, { data: null, bootError: null, section: 'conversations', conversationId: '', search: '', searchFocused: false, sidebarWidth: 250, collapsed: false, createProjectDialogOpen: false, settingsOpen: false });
  useEffect(() => { void client.bootstrap().then(data => dispatch({ type: 'boot', data })).catch((error: unknown) => dispatch({ type: 'set', patch: { bootError: error instanceof Error ? error.message : '启动失败' } })); }, [client]);
  const selectedConversation = useMemo(() => state.data?.conversations.find(item => item.id === state.conversationId) ?? null, [state.data, state.conversationId]);
  if (state.bootError) return <main className="loading-shell"><div><p>启动失败:{state.bootError}</p><button type="button" onClick={() => window.location.reload()}>重试</button></div></main>;
  if (!state.data) return <main className="loading-shell">Loading Workbench vNext…</main>;
  const createProject = async (input: CreateProjectInput) => {
    const result = await client.createProject(input);
    dispatch({ type: 'project', result });
    if (result.modelError) dispatch({ type: 'append', conversationId: result.conversation.id, message: { id: `local-error-${Date.now()}`, author: 'assistant', agentId: result.conversation.agentId, text: `【模型调用失败】${result.modelError}。请在下方重发一条消息，我会结合上文回答。` } });
  };
  return <AppShell state={{ ...state, data: state.data }} dispatch={dispatch} client={client} selectedConversation={selectedConversation} onCreateProject={createProject} />;
}
