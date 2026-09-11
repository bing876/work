import type {
  AgentSummary,
  AgentTurn,
  Artifact,
  CreateProjectInput,
  CreateProjectResult,
  Message,
  Project,
  SendMessageInput,
  Task,
  WorkbenchBootstrap,
  WorkbenchClient,
} from "./workbench-client";
import { defaultProjectAvatar } from "../assets/project-avatars";

const initial: WorkbenchBootstrap = {
  user: { name: "用户", initials: "U" },
  projects: [
    {
      id: "project-launch",
      name: "春季新品发布",
      agentId: "launch-agent",
      conversationId: "conv-launch",
      status: "executing",
      template: "launch",
      avatar: defaultProjectAvatar(0),
    },
  ],
  tasks: [
    {
      id: "task-launch-goal",
      projectId: "project-launch",
      title: "梳理发布目标",
      detail: "已整理受众、卖点与发布时间窗口",
      status: "completed",
    },
    {
      id: "task-launch-strategy",
      projectId: "project-launch",
      title: "建立内容与渠道策略",
      detail: "正在生成传播节奏与渠道建议",
      status: "running",
    },
    {
      id: "task-launch-delivery",
      projectId: "project-launch",
      title: "整理发布交付物",
      detail: "等待策略确认后生成文件包",
      status: "queued",
    },
  ],
  artifacts: [
    {
      id: "artifact-launch-brief",
      projectId: "project-launch",
      name: "新品发布策略简报.md",
      kind: "策略简报",
      summary: "定位、受众与核心信息",
      status: "ready",
    },
    {
      id: "artifact-launch-plan",
      projectId: "project-launch",
      name: "发布节奏计划.pdf",
      kind: "执行计划",
      summary: "渠道、时间线与责任分工",
      status: "pending",
    },
  ],
  agents: [
    {
      id: "launch-agent",
      name: "春季新品发布",
      role: "项目 Agent",
      initials: "春",
      tone: "prototype-avatar-1",
      status: "working",
      preview: "正在生成内容与渠道策略",
    },
    {
      id: "assistant",
      name: "我的助手",
      role: "个人智能体",
      initials: "我",
      tone: "prototype-avatar-1",
      status: "ready",
      preview: "扫码绑定 OpenClaw 客户端",
    },
    {
      id: "chen-mo",
      name: "陈默",
      role: "设计协作",
      initials: "陈",
      tone: "prototype-avatar-2",
      status: "ready",
      preview: "[文件] 交互稿_v3.fig",
    },
    {
      id: "su-li",
      name: "苏离",
      role: "产品协作",
      initials: "苏",
      tone: "prototype-avatar-3",
      status: "working",
      preview: "这版配色我这边 OK",
    },
    {
      id: "gu-beichen",
      name: "顾北辰",
      role: "项目协作",
      initials: "顾",
      tone: "prototype-avatar-4",
      status: "away",
      preview: "周末一起去爬灵隐？",
    },
    {
      id: "white-peach",
      name: "白桃乌龙",
      role: "内容协作",
      initials: "白",
      tone: "prototype-avatar-5",
      status: "ready",
      preview: "[表情]",
    },
    {
      id: "zhou-yuan",
      name: "周予安",
      role: "文档协作",
      initials: "周",
      tone: "prototype-avatar-6",
      status: "ready",
      preview: "需求文档我放到共享盘了",
    },
  ],
  conversations: [
    {
      id: "conv-launch",
      agentId: "launch-agent",
      title: "春季新品发布",
      preview: "正在生成内容与渠道策略",
      updatedAt: "刚刚",
    },
    {
      id: "conv-assistant",
      agentId: "assistant",
      title: "我的助手",
      preview: "扫码绑定 OpenClaw 客户端",
      updatedAt: "14:32",
    },
    {
      id: "conv-chen-mo",
      agentId: "chen-mo",
      title: "陈默",
      preview: "[文件] 交互稿_v3.fig",
      updatedAt: "13:07",
    },
    {
      id: "conv-su-li",
      agentId: "su-li",
      title: "苏离",
      preview: "这版配色我这边 OK",
      updatedAt: "11:49",
    },
    {
      id: "conv-gu-beichen",
      agentId: "gu-beichen",
      title: "顾北辰",
      preview: "周末一起去爬灵隐？",
      updatedAt: "昨天",
    },
    {
      id: "conv-white-peach",
      agentId: "white-peach",
      title: "白桃乌龙",
      preview: "[表情]",
      updatedAt: "昨天",
    },
    {
      id: "conv-zhou-yuan",
      agentId: "zhou-yuan",
      title: "周予安",
      preview: "需求文档我放到共享盘了",
      updatedAt: "周二",
    },
  ],
  messages: {
    "conv-launch": [
      {
        id: "message-launch-user",
        author: "user",
        agentId: "launch-agent",
        text: "为春季新品发布准备完整方案，覆盖定位、传播节奏和交付物。",
      },
      {
        id: "message-launch-agent",
        author: "assistant",
        agentId: "launch-agent",
        text: "我已建立新品发布工作流：先确认目标，再生成内容与渠道策略。你可以继续补充信息，或直接发送“继续执行”推进剩余任务。",
      },
    ],
    "conv-assistant": [],
    "conv-chen-mo": [],
    "conv-su-li": [],
    "conv-gu-beichen": [],
    "conv-white-peach": [],
    "conv-zhou-yuan": [],
  },
  models: [
    { id: "deepseek", name: "DeepSeek", description: "V4 Pro", color: "#5f81ff" },
    { id: "zhipu", name: "GLM", description: "5.2", color: "#3c8ff6" },
    { id: "chatgpt", name: "ChatGPT", description: "GPT-5.6", color: "#ffffff" },
    { id: "claude", name: "Claude", description: "Opus 5", color: "#d88a62" },
    { id: "gemini", name: "Gemini", description: "3.1 Pro", color: "#5b9dff" },
    { id: "grok", name: "Grok", description: "4.6", color: "#f5f5f5" },
    { id: "qwen", name: "Qwen", description: "3.8 Max", color: "#8a68ff" },
    { id: "kimi", name: "Kimi", description: "K3", color: "#ffa83b" },
    { id: "hunyuan", name: "混元", description: "Hy3", color: "#2d96ee" },
  ],
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class MockWorkbenchClient implements WorkbenchClient {
  private state = clone(initial);
  private projectSequence = 0;

  async bootstrap(): Promise<WorkbenchBootstrap> {
    return clone(this.state);
  }
  async sendMessage(input: SendMessageInput): Promise<AgentTurn> {
    const project = this.state.projects.find(
      (item) => item.conversationId === input.conversationId,
    );
    if (project && project.status !== "completed") {
      const completedProject: Project = { ...project, status: "completed" };
      const tasks = this.state.tasks.map((item) =>
        item.projectId === project.id
          ? {
              ...item,
              status: "completed" as const,
              detail:
                item.status === "completed" ? item.detail : "已由 Mock Agent 完成并汇总到交付物",
            }
          : item,
      );
      const artifacts = this.state.artifacts.map((item) =>
        item.projectId === project.id ? { ...item, status: "ready" as const } : item,
      );
      this.state.projects = this.state.projects.map((item) =>
        item.id === project.id ? completedProject : item,
      );
      this.state.tasks = tasks;
      this.state.artifacts = artifacts;
      this.state.agents = this.state.agents.map((item) =>
        item.id === project.agentId
          ? { ...item, status: "ready" as const, preview: "交付物已就绪" }
          : item,
      );
      const reply: Message = {
        id: `mock-${Date.now()}`,
        author: "assistant",
        agentId: input.agentId,
        text: `已完成模拟执行：已根据“${input.text}”收束任务，发布文件已准备就绪。`,
        blocks: [
          {
            type: "text",
            title: "Mock Experience",
            body: "此结果由 MockWorkbenchClient 确定性生成，未调用真实模型、Kernel 或 Runtime。",
          },
        ],
      };
      this.state.messages[input.conversationId] = [
        ...(this.state.messages[input.conversationId] ?? []),
        reply,
      ];
      return clone({
        message: reply,
        project: completedProject,
        tasks: tasks.filter((item) => item.projectId === project.id),
        artifacts: artifacts.filter((item) => item.projectId === project.id),
      });
    }
    const reply: Message = {
      id: `mock-${Date.now()}`,
      author: "assistant",
      agentId: input.agentId,
      text: `这是由 Mock Client 返回的确定性界面响应：已收到“${input.text}”。`,
      blocks: [
        {
          type: "text",
          title: "Mock Mode",
          body: `模型入口显示为 ${input.modelId}；尚未调用真实模型、Kernel 或 Runtime。`,
        },
      ],
    };
    this.state.messages[input.conversationId] = [
      ...(this.state.messages[input.conversationId] ?? []),
      reply,
    ];
    return clone({ message: reply });
  }
  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const name = this.resolveProjectName(input);
    const id = `mock-project-${++this.projectSequence}`;
    const launch = /发布|新品|品牌|launch/i.test(`${name}\n${input.initialMessage}`);
    const avatar = input.avatar ?? defaultProjectAvatar(this.state.projects.length);
    const project: Project = {
      id,
      name,
      agentId: id,
      conversationId: `conv-${id}`,
      status: "executing",
      template: launch ? "launch" : "general",
      avatar,
    };
    const agent: AgentSummary = {
      id,
      name,
      role: "项目 Agent",
      initials: name.slice(0, 1) || "项",
      tone: "project-avatar",
      status: "working",
      preview: launch ? "正在生成内容与渠道策略" : "正在建立项目执行计划",
    };
    const conversation = {
      id: project.conversationId,
      agentId: id,
      title: name,
      preview: agent.preview,
      updatedAt: "刚刚",
    };
    const initialMessage: Message | undefined = input.initialMessage
      ? {
          id: `message-${id}`,
          author: "user",
          agentId: id,
          text: input.initialMessage,
          attachments: clone(input.attachments),
        }
      : undefined;
    const tasks = this.workflowTasks(project);
    const artifacts = this.workflowArtifacts(project);
    const agentMessage: Message = {
      id: `message-${id}-agent`,
      author: "assistant",
      agentId: id,
      text: launch
        ? "项目已进入新品发布工作流：我正在整理内容与渠道策略。发送任意补充信息或“继续执行”，即可完成剩余任务并生成发布文件。"
        : "项目已进入通用执行工作流：我正在建立目标、行动项与交付物。发送任意补充信息或“继续执行”，即可完成剩余任务并生成文件结果。",
    };
    const messages = initialMessage ? [initialMessage, agentMessage] : [agentMessage];
    this.state.projects.push(project);
    this.state.tasks.push(...tasks);
    this.state.artifacts.push(...artifacts);
    this.state.agents.push(agent);
    this.state.conversations.push(conversation);
    this.state.messages[conversation.id] = messages;
    return clone({
      project,
      agent,
      conversation,
      messages,
      tasks,
      artifacts,
      ...(initialMessage ? { initialMessage } : {}),
    });
  }

  private workflowTasks(project: Project): Task[] {
    const steps: Array<[string, string]> =
      project.template === "launch"
        ? [
            ["确认发布目标", "已识别项目需求与上下文"],
            ["建立内容与渠道策略", "正在生成传播节奏与渠道建议"],
            ["整理发布交付物", "等待策略确认后生成文件包"],
          ]
        : [
            ["理解项目目标", "已读取需求与附件上下文"],
            ["制定执行路径", "正在生成任务拆解与优先级"],
            ["整理交付结果", "等待执行完成后生成文件"],
          ];
    return steps.map(([title, detail], index) => ({
      id: `${project.id}-task-${index + 1}`,
      projectId: project.id,
      title,
      detail,
      status: index === 0 ? "completed" : index === 1 ? "running" : "queued",
    }));
  }

  private workflowArtifacts(project: Project): Artifact[] {
    const files: Array<[string, string, string]> =
      project.template === "launch"
        ? [
            ["新品发布策略简报.md", "策略简报", "定位、受众与核心信息"],
            ["发布节奏计划.pdf", "执行计划", "渠道、时间线与责任分工"],
          ]
        : [
            ["项目执行简报.md", "项目简报", "目标、范围与执行建议"],
            ["任务交付清单.pdf", "交付清单", "任务状态与后续行动"],
          ];
    return files.map(([name, kind, summary], index) => ({
      id: `${project.id}-artifact-${index + 1}`,
      projectId: project.id,
      name,
      kind,
      summary,
      status: index === 0 ? "ready" : "pending",
    }));
  }

  private resolveProjectName(input: CreateProjectInput): string {
    if (input.name.trim()) return input.name.trim();
    if (input.workingFolder?.displayName) return input.workingFolder.displayName;
    const base = new Date().toISOString().slice(0, 10);
    const used = new Set(this.state.conversations.map((item) => item.title));
    if (!used.has(base)) return base;
    for (let index = 2; ; index += 1) {
      const candidate = `${base} ${String(index).padStart(2, "0")}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}
