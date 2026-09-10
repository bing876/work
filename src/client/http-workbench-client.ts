// 任务2:用真实后端替换 Mock。实现同一个 WorkbenchClient 接口,界面零改动。
// baseUrl 为空字符串 = 走同源 /api(开发时由 Vite 代理转发给后端),避免浏览器直连 localhost。
import type {
  AgentSummary,
  AgentTurn,
  Consensus,
  CorrectConsensusInput,
  ConversationSummary,
  CreateProjectInput,
  CreateProjectResult,
  Message,
  ProductProfile,
  Project,
  SendMessageInput,
  UpdateProjectProfileInput,
  WorkbenchBootstrap,
  WorkbenchClient,
} from './workbench-client';
import { defaultProjectAvatar } from '../assets/project-avatars';
import { getUser, notifyUnauthorized } from './auth';

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
  private getToken: (() => string | null) | null;

  constructor(options: { baseUrl?: string; getToken?: () => string | null } = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.getToken = options.getToken ?? null;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    const token = this.getToken?.();
    const headers: Record<string, string> = { ...((init?.headers as Record<string, string> | undefined) ?? {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new Error('连不上后端服务,请确认后端已启动');
    }
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (response.status === 401) {
      notifyUnauthorized();
      throw new Error('登录已过期,请重新登录');
    }
    if (!response.ok || !data || data.ok !== true) {
      throw new Error(typeof data?.error === 'string' ? data.error : `后端返回异常(${response.status})`);
    }
    return data as T;
  }

  async bootstrap(): Promise<WorkbenchBootstrap> {
    const data = await this.request<{ projects: ServerProject[] }>('/api/projects');
    // 真实模型名问后端;问不到也不挡启动
    let serverModel = 'deepseek-chat';
    try {
      serverModel = (await this.request<{ model: string }>('/api/meta')).model || serverModel;
    } catch {
      /* 忽略,用默认名 */
    }
    const storedUser = getUser();
    const projects = data.projects.map((row, index) => toProject(row, index));
    const agents = projects.map(toAgent);
    const conversations = data.projects.map((row, index) => toConversation(row, projects[index]));
    const messages: Record<string, Message[]> = {};
    const consensus: Record<string, Consensus> = {};
    await Promise.all(
      data.projects.map(async (row, index) => {
        const box = await this.request<{ messages: ServerMessage[] }>(`/api/projects/${row.id}/messages`);
        messages[conversations[index].id] = box.messages.map((item) => toMessage(item, projects[index].agentId));
        const box2 = await this.request<{ consensus: Consensus }>(`/api/projects/${row.id}/consensus`);
        consensus[projects[index].id] = box2.consensus;
      }),
    );
    return {
      user: storedUser ? { name: storedUser.phone, initials: storedUser.phone.slice(-2) } : { name: '用户', initials: 'U' },
      projects,
      tasks: [],
      artifacts: [],
      agents,
      conversations,
      messages,
      consensus,
      models: [{ id: 'server', name: serverModel, description: '后端配置', color: '#5f81ff' }],
      selectedModelId: 'server',
    };
  }

  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const name = input.name.trim() || new Date().toISOString().slice(0, 10);
    const data = await this.request<{ project: ServerProject; messages: ServerMessage[]; consensus: Consensus; modelError?: string }>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, initialMessage: input.initialMessage.trim() || undefined }),
    });
    const project = toProject(data.project, Number(data.project.id) || 0);
    const agent = toAgent(project);
    const conversation = toConversation(data.project, project);
    const messages = data.messages.map((item) => toMessage(item, agent.id));
    const initialMessage = messages.find((item) => item.author === 'user');
    return { project, agent, conversation, messages, tasks: [], artifacts: [], consensus: data.consensus, initialMessage, ...(data.modelError ? { modelError: data.modelError } : {}) };
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

  // AI 对话走后端模型,返回回复+项目+共识
  async sendMessage(input: SendMessageInput): Promise<AgentTurn> {
    const match = input.conversationId.match(/^conv-srv-(\d+)$/);
    if (!match) throw new Error('该会话不是后端会话,不支持在线对话');
    const data = await this.request<{ reply: { text: string }; done: boolean; project: ServerProject; consensus: Consensus }>(
      `/api/projects/${match[1]}/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: input.text }) },
    );
    const message: Message = { id: `srv-chat-${Date.now()}`, author: 'assistant', agentId: input.agentId, text: data.reply.text };
    return { message, project: toProject(data.project, 0), consensus: data.consensus };
  }

  async getConsensus(projectId: string): Promise<Consensus> {
    const match = projectId.match(/^srv-(\d+)$/);
    if (!match) throw new Error('该项目不是后端项目,不支持读取共识');
    const data = await this.request<{ consensus: Consensus }>(`/api/projects/${match[1]}/consensus`);
    return data.consensus;
  }

  async correctConsensus(input: CorrectConsensusInput): Promise<Consensus> {
    const match = input.projectId.match(/^srv-(\d+)$/);
    if (!match) throw new Error('该项目不是后端项目,不支持纠正记忆');
    const data = await this.request<{ consensus: Consensus }>(`/api/projects/${match[1]}/consensus`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'correct', id: input.id, text: input.text }),
    });
    return data.consensus;
  }
}
