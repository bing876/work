// 任务2:用真实后端替换 Mock。实现同一个 WorkbenchClient 接口,界面零改动。
// baseUrl 为空字符串 = 走同源 /api(开发时由 Vite 代理转发给后端),避免浏览器直连 localhost。
import type {
  AgentSummary,
  AgentTurn,
  ConversationSummary,
  CreateProjectInput,
  CreateProjectResult,
  Message,
  ModelOption,
  ProductProfile,
  Project,
  SendMessageInput,
  UpdateProjectProfileInput,
  WorkbenchBootstrap,
  WorkbenchClient,
} from './workbench-client';
import { defaultProjectAvatar } from '../assets/project-avatars';

interface ServerProject {
  id: number;
  name: string;
  created_at: string;
  profile: ProductProfile | null;
  plan: string | null;
  draft: string | null;
  phase: Project['phase'];
}

interface ServerMessage {
  id: number;
  author: 'user' | 'assistant';
  text: string;
  created_at: string;
}

const MODELS: ModelOption[] = [
  { id: 'deepseek', name: 'DeepSeek', description: 'V4 Pro', color: '#5f81ff' },
  { id: 'zhipu', name: 'GLM', description: '5.2', color: '#3c8ff6' },
  { id: 'chatgpt', name: 'ChatGPT', description: 'GPT-5.6', color: '#ffffff' },
  { id: 'claude', name: 'Claude', description: 'Opus 5', color: '#d88a62' },
  { id: 'gemini', name: 'Gemini', description: '3.1 Pro', color: '#5b9dff' },
  { id: 'grok', name: 'Grok', description: '4.6', color: '#f5f5f5' },
  { id: 'qwen', name: 'Qwen', description: '3.8 Max', color: '#8a68ff' },
  { id: 'kimi', name: 'Kimi', description: 'K3', color: '#ffa83b' },
  { id: 'hunyuan', name: '混元', description: 'Hy3', color: '#2d96ee' },
];

const isLaunch = (name: string, initialMessage: string) =>
  /发布|新品|品牌|launch/i.test(`${name}\n${initialMessage}`);

function toProject(row: ServerProject, avatarIndex: number, avatar?: Project['avatar']): Project {
  const id = `srv-${row.id}`;
  return {
    id,
    name: row.name,
    agentId: id,
    conversationId: `conv-${id}`,
    status: 'executing',
    template: isLaunch(row.name, '') ? 'launch' : 'general',
    avatar: avatar ?? defaultProjectAvatar(avatarIndex),
    profile: row.profile,
    plan: row.plan,
    draft: row.draft,
    phase: row.phase,
  };
}

const toMessage = (row: ServerMessage, agentId: string): Message => ({
  id: `srv-msg-${row.id}`,
  author: row.author,
  agentId,
  text: row.text,
});

function toAgent(project: Project): AgentSummary {
  return {
    id: project.agentId,
    name: project.name,
    role: '项目 Agent',
    initials: project.name.slice(0, 1) || '项',
    tone: 'project-avatar',
    status: 'working',
    preview: 'AI产品经理引导中',
  };
}

function toConversation(row: ServerProject, project: Project): ConversationSummary {
  return {
    id: project.conversationId,
    agentId: project.agentId,
    title: row.name,
    preview: '真实后端项目',
    updatedAt: row.created_at.slice(0, 10),
  };
}

export class HttpWorkbenchClient implements WorkbenchClient {
  private baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? '';
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, init);
    } catch {
      throw new Error('连不上后端服务,请确认后端已启动');
    }
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !data || data.ok !== true) {
      throw new Error(typeof data?.error === 'string' ? data.error : `后端返回异常(${response.status})`);
    }
    return data as T;
  }

  async bootstrap(): Promise<WorkbenchBootstrap> {
    const data = await this.request<{ projects: ServerProject[] }>('/api/projects');
    const projects = data.projects.map((row, index) => toProject(row, index));
    const agents = projects.map(toAgent);
    const conversations = data.projects.map((row, index) => toConversation(row, projects[index]));
    const messages: Record<string, Message[]> = {};
    await Promise.all(
      data.projects.map(async (row, index) => {
        const box = await this.request<{ messages: ServerMessage[] }>(`/api/projects/${row.id}/messages`);
        messages[conversations[index].id] = box.messages.map((item) => toMessage(item, projects[index].agentId));
      }),
    );
    return {
      user: { name: '用户', initials: 'U' },
      projects,
      tasks: [],
      artifacts: [],
      agents,
      conversations,
      messages,
      models: MODELS,
      selectedModelId: 'chatgpt',
    };
  }

  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const name = input.name.trim() || input.workingFolder?.displayName || new Date().toISOString().slice(0, 10);
    const data = await this.request<{ project: ServerProject; messages: ServerMessage[]; modelError?: string }>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, initialMessage: input.initialMessage.trim() || undefined }),
    });
    const project = toProject(data.project, 0, input.avatar);
    const agent = toAgent(project);
    const conversation = toConversation(data.project, project);
    const messages = data.messages.map((item) => toMessage(item, agent.id));
    const initialMessage = messages.find((item) => item.author === 'user');
    return { project, agent, conversation, messages, tasks: [], artifacts: [], initialMessage, ...(data.modelError ? { modelError: data.modelError } : {}) };
  }

  async updateProjectProfile(input: UpdateProjectProfileInput): Promise<Project> {
    const match = input.projectId.match(/^srv-(\d+)$/);
    if (!match) throw new Error('该项目不是后端项目,不支持在线保存资料');
    const data = await this.request<{ project: ServerProject }>(`/api/projects/${match[1]}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: input.profile }),
    });
    // 注意:后端不存头像,App reducer 合并时会保留当前头像
    return toProject(data.project, 0);
  }

  // 访谈对话走后端剧本引擎(任务5会换成真 AI,接口不变)
  async sendMessage(input: SendMessageInput): Promise<AgentTurn> {
    const match = input.conversationId.match(/^conv-srv-(\d+)$/);
    if (!match) throw new Error('该会话不是后端会话,不支持在线对话');
    const data = await this.request<{ reply: { text: string }; done: boolean; project: ServerProject }>(
      `/api/projects/${match[1]}/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: input.text }) },
    );
    const message: Message = { id: `srv-chat-${Date.now()}`, author: 'assistant', agentId: input.agentId, text: data.reply.text };
    return { message, project: toProject(data.project, 0) };
  }
}
