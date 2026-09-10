import type { AgentTurn, Message, RailSection, WorkbenchBootstrap } from '../client/workbench-client';

export type ShellState = {
  data: WorkbenchBootstrap;
  section: RailSection;
  conversationId: string;
  search: string;
  searchFocused: boolean;
  sidebarWidth: number;
  collapsed: boolean;
  toolOpen: boolean;
  modelOpen: boolean;
  createProjectDialogOpen: boolean;
  settingsOpen: boolean;
};

export type Action =
  | { type: 'set'; patch: Partial<ShellState> }
  | { type: 'append'; conversationId: string; message: Message }
  | { type: 'agent-turn'; result: AgentTurn };
