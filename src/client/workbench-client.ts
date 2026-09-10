export type AgentStatus = 'ready' | 'working' | 'away';
export type RailSection = 'conversations' | 'contacts' | 'saved' | 'files' | 'moments';
export type ProjectStatus = 'planning' | 'executing' | 'completed';
export type TaskStatus = 'queued' | 'running' | 'completed';
export type ArtifactStatus = 'pending' | 'ready';

export type ProjectAvatar = { source: 'library'; id: string } | { source: 'upload'; name: string; mimeType: string; size: number; dataUrl: string };
export interface AgentSummary { id: string; name: string; role: string; initials: string; tone: string; status: AgentStatus; preview: string; }
export interface ConversationSummary { id: string; agentId: string; title: string; preview: string; updatedAt: string; unread?: number; }
export interface ProductProfile { productName: string; category: string; price: string; specs: string; sellingPoints: string; notes: string; }
export interface Project { id: string; name: string; agentId: string; conversationId: string; status: ProjectStatus; template: 'launch' | 'general'; avatar: ProjectAvatar; profile?: ProductProfile | null; plan?: string | null; }
export interface Task { id: string; projectId: string; title: string; detail: string; status: TaskStatus; }
export interface Artifact { id: string; projectId: string; name: string; kind: string; summary: string; status: ArtifactStatus; }
export interface MessageBlock { type: 'text' | 'code' | 'artifact' | 'error'; title?: string; body: string; }
export interface AttachmentRef { id: string; displayName: string; mimeType: string; size: number; }
export interface Message { id: string; author: 'user' | 'assistant'; agentId: string; text: string; attachments?: AttachmentRef[]; blocks?: MessageBlock[]; state?: 'complete' | 'thinking' | 'error'; }
export interface ModelOption { id: string; name: string; description: string; color: string; }
export interface WorkbenchBootstrap { user: { name: string; initials: string }; projects: Project[]; tasks: Task[]; artifacts: Artifact[]; agents: AgentSummary[]; conversations: ConversationSummary[]; messages: Record<string, Message[]>; models: ModelOption[]; selectedModelId: string; }
export interface SendMessageInput { conversationId: string; agentId: string; text: string; modelId: string; }
export interface CreateProjectInput {
  avatar?: ProjectAvatar;
  name: string;
  workingFolder: { displayName: string; mockRef: string } | null;
  initialMessage: string;
  attachments: AttachmentRef[];
  templateEnabled: boolean;
  industryIntelligenceEnabled: boolean;
}
export interface CreateProjectResult { project: Project; agent: AgentSummary; conversation: ConversationSummary; messages: Message[]; tasks: Task[]; artifacts: Artifact[]; initialMessage?: Message; }
export interface AgentTurn { message: Message; project?: Project; tasks?: Task[]; artifacts?: Artifact[]; }
export interface UpdateProjectProfileInput { projectId: string; profile: ProductProfile; }

/** Phase 0 frontend port. This is intentionally not the future Application API contract. */
export interface WorkbenchClient {
  bootstrap(): Promise<WorkbenchBootstrap>;
  sendMessage(input: SendMessageInput): Promise<AgentTurn>;
  createProject(input: CreateProjectInput): Promise<CreateProjectResult>;
  updateProjectProfile(input: UpdateProjectProfileInput): Promise<Project>;
}
