import type {
  AgentTurn,
  CreateProjectInput,
  CreateProjectResult,
  ConversationSummary,
  Message,
  WorkbenchBootstrap,
  WorkbenchClient,
} from "../client/workbench-client";

export type ShellState = {
  data: WorkbenchBootstrap;
  conversationId: string;
  selectedModelId: string;
  search: string;
  searchFocused: boolean;
  sidebarWidth: number;
  collapsed: boolean;
  toolOpen: boolean;
  modelOpen: boolean;
  createProjectDialogOpen: boolean;
  settingsOpen: boolean;
};

export type AppState = Omit<ShellState, "data"> & { data: WorkbenchBootstrap | null };

export type Action =
  | { type: "boot"; data: WorkbenchBootstrap }
  | { type: "set"; patch: Partial<ShellState> }
  | { type: "append"; conversationId: string; message: Message }
  | { type: "project"; result: CreateProjectResult }
  | { type: "agent-turn"; result: AgentTurn };

export type AppShellProps = {
  state: ShellState;
  dispatch: React.Dispatch<Action>;
  client: WorkbenchClient;
  selectedConversation: ConversationSummary | null;
  onCreateProject: (input: CreateProjectInput) => Promise<void>;
};
