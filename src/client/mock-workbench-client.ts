import type { AgentSummary, AgentTurn, Artifact, Consensus, CorrectConsensusInput, CreateProjectInput, CreateProjectResult, Message, Project, SendMessageInput, Task, UpdateProjectProfileInput, WorkbenchBootstrap, WorkbenchClient } from './workbench-client';
import { defaultProjectAvatar } from '../assets/project-avatars';

const initial: WorkbenchBootstrap = {
  user: { name: '用户', initials: 'U' },
  projects: [{ id: 'project-launch', name: '春季新品发布', agentId: 'launch-agent', conversationId: 'conv-launch', status: 'executing', template: 'launch', avatar: defaultProjectAvatar(0), phase: 'collecting' }],
  tasks: [
    { id: 'task-launch-goal', projectId: 'project-launch', title: '梳理发布目标', detail: '已整理受众、卖点与发布时间窗口', status: 'completed' },
    { id: 'task-launch-strategy', projectId: 'project-launch', title: '建立内容与渠道策略', detail: '正在生成传播节奏与渠道建议', status: 'running' },
    { id: 'task-launch-delivery', projectId: 'project-launch', title: '整理发布交付物', detail: '等待策略确认后生成文件包', status: 'queued' },
  ],
  artifacts: [
    { id: 'artifact-launch-brief', projectId: 'project-launch', name: '新品发布策略简报.md', kind: '策略简报', summary: '定位、受众与核心信息', status: 'ready' },
    { id: 'artifact-launch-plan', projectId: 'project-launch', name: '发布节奏计划.pdf', kind: '执行计划', summary: '渠道、时间线与责任分工', status: 'pending' },
  ],
  agents: [
    { id: 'launch-agent', name: '春季新品发布', role: '项目 Agent', initials: '春', tone: 'prototype-avatar-1', status: 'working', preview: '正在生成内容与渠道策略' },
    { id: 'assistant', name: '我的助手', role: '个人智能体', initials: '我', tone: 'prototype-avatar-1', status: 'ready', preview: '扫码绑定 OpenClaw 客户端' },
    { id: 'chen-mo', name: '陈默', role: '设计协作', initials: '陈', tone: 'prototype-avatar-2', status: 'ready', preview: '[文件] 交互稿_v3.fig' },
    { id: 'su-li', name: '苏离', role: '产品协作', initials: '苏', tone: 'prototype-avatar-3', status: 'working', preview: '这版配色我这边 OK' },
    { id: 'gu-beichen', name: '顾北辰', role: '项目协作', initials: '顾', tone: 'prototype-avatar-4', status: 'away', preview: '周末一起去爬灵隐？' },
    { id: 'white-peach', name: '白桃乌龙', role: '内容协作', initials: '白', tone: 'prototype-avatar-5', status: 'ready', preview: '[表情]' },
    { id: 'zhou-yuan', name: '周予安', role: '文档协作', initials: '周', tone: 'prototype-avatar-6', status: 'ready', preview: '需求文档我放到共享盘了' },
  ],
  conversations: [
    { id: 'conv-launch', agentId: 'launch-agent', title: '春季新品发布', preview: '正在生成内容与渠道策略', updatedAt: '刚刚' },
    { id: 'conv-assistant', agentId: 'assistant', title: '我的助手', preview: '扫码绑定 OpenClaw 客户端', updatedAt: '14:32' },
    { id: 'conv-chen-mo', agentId: 'chen-mo', title: '陈默', preview: '[文件] 交互稿_v3.fig', updatedAt: '13:07' },
    { id: 'conv-su-li', agentId: 'su-li', title: '苏离', preview: '这版配色我这边 OK', updatedAt: '11:49' },
    { id: 'conv-gu-beichen', agentId: 'gu-beichen', title: '顾北辰', preview: '周末一起去爬灵隐？', updatedAt: '昨天' },
    { id: 'conv-white-peach', agentId: 'white-peach', title: '白桃乌龙', preview: '[表情]', updatedAt: '昨天' },
    { id: 'conv-zhou-yuan', agentId: 'zhou-yuan', title: '周予安', preview: '需求文档我放到共享盘了', updatedAt: '周二' },
  ],
  messages: {
    'conv-launch': [
      { id: 'message-launch-user', author: 'user', agentId: 'launch-agent', text: '为春季新品发布准备完整方案，覆盖定位、传播节奏和交付物。' },
      { id: 'message-launch-agent', author: 'assistant', agentId: 'launch-agent', text: '我已建立新品发布工作流：先确认目标，再生成内容与渠道策略。你可以继续补充信息，或直接发送“继续执行”推进剩余任务。' },
    ],
    'conv-assistant': [],
    'conv-chen-mo': [],
    'conv-su-li': [],
    'conv-gu-beichen': [],
    'conv-white-peach': [],
    'conv-zhou-yuan': [],
  },
  models: [
    { id: 'deepseek', name: 'DeepSeek', description: 'V4 Pro', color: '#5f81ff' },
    { id: 'zhipu', name: 'GLM', description: '5.2', color: '#3c8ff6' },
    { id: 'chatgpt', name: 'ChatGPT', description: 'GPT-5.6', color: '#ffffff' },
    { id: 'claude', name: 'Claude', description: 'Opus 5', color: '#d88a62' },
    { id: 'gemini', name: 'Gemini', description: '3.1 Pro', color: '#5b9dff' },
    { id: 'grok', name: 'Grok', description: '4.6', color: '#f5f5f5' },
    { id: 'qwen', name: 'Qwen', description: '3.8 Max', color: '#8a68ff' },
    { id: 'kimi', name: 'Kimi', description: 'K3', color: '#ffa83b' },
    { id: 'hunyuan', name: '混元', description: 'Hy3', color: '#2d96ee' },
  ],
  selectedModelId: 'chatgpt',
  consensus: {},
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// SCRIPT-MIRROR:与 server/interview.js + server/index.mjs 状态机同步的演示副本。
// Mock 只演界面,不联网、不持久。改规则时,两边一起改。
const MOCK_OPENING = '您好！我是您的AI产品经理，我能为你做些什么？';
const MOCK_COMPLETED = '上架文案初稿已生成(见上方对话)。(Mock 演示数据,刷新即丢)';
const MOCK_CONFIRM_EXAMPLE = '回复“确认”开始执行，或说哪里要改(比如“价格改成199元”)。';
const MOCK_FIELD_NAMES = ['生意方向', '商品', '价格', '客户', '渠道'];
const mockClip = (value: string, length: number) => value.trim().slice(0, length);
const MOCK_INTENTS: { pattern: RegExp; intent: string; thing: string }[] = [
  { pattern: /茶/, intent: '茶叶生意', thing: '茶叶' },
  { pattern: /服装|衣服|女装|男装|童装|鞋|包/, intent: '服装生意', thing: '服装' },
  { pattern: /美妆|化妆品|护肤|口红/, intent: '美妆生意', thing: '美妆产品' },
  { pattern: /数码|手机|电子|耳机|电脑/, intent: '数码生意', thing: '数码产品' },
  { pattern: /食品|零食|水果|特产/, intent: '食品生意', thing: '食品' },
];
const mockDetectIntent = (text: string) => MOCK_INTENTS.find((rule) => rule.pattern.test(text)) ?? null;
const mockStyleForPrice = (text: string) => {
  const number = Number(text.replace(/[^0-9.]/g, '').slice(0, 10));
  if (!Number.isFinite(number) || number <= 0) return '突出核心卖点';
  if (number >= 500) return '偏向高端质感';
  if (number >= 100) return '兼顾品质与性价比';
  return '突出性价比';
};
const mockIsQuestion = (text: string) =>
  /[?？]|吗\s*$|怎么|什么|如何|为什么|能不能|可以不|会不会|你能|你会|多少|哪个|哪些/.test(text);
const mockIsConfirm = (text: string) =>
  /确认|同意|没问题|可以开始|开始执行|执行吧|^ *(好的|好|行|OK|ok|开始|可以) *$/.test(text.trim());
const mockIsContinue = (text: string) => /继续|下一步|往下|go/i.test(text);
const mockIsPause = (text: string) => /暂停|等一下|等等|先停|休息/.test(text);
const mockParseCorrection = (text: string): { index: number; value: string } | null => {
  const rules: { pattern: RegExp; index: number }[] = [
    { pattern: /价格|价钱|价位|定价/, index: 2 },
    { pattern: /商品|产品|茶叶|东西|卖什么/, index: 1 },
    { pattern: /客户|人群|对象|卖给谁/, index: 3 },
    { pattern: /渠道|平台|哪里卖|在哪卖/, index: 4 },
    { pattern: /生意|项目|类目|做什么/, index: 0 },
  ];
  const mark = text.match(/(改成|改为|改一下|改|换成|应该是|是|为|:|：)/);
  if (!mark || mark.index === undefined) return null;
  const value = mockClip(text.slice(mark.index + mark[0].length), 30).replace(/[。！？!?,，\s]+$/g, '');
  if (!value) return null;
  const rule = rules.find((item) => item.pattern.test(text.slice(0, mark.index)));
  return rule ? { index: rule.index, value } : null;
};
const mockCapabilityAnswer = (intentName?: string) =>
  [
    `我能为您做什么(${intentName ?? '各品类开店前的资料准备'}):`,
    '1)陪您聊清楚要做什么(需求引导)', '2)整理成项目档案', '3)生成执行计划和上架文案初稿',
    '我目前还不能:', '1)不能代替您开店、上架(需要您手动操作)', '2)不能做图、拍视频', '3)不能保证销量，初稿需要您把关',
    '将交付:①项目档案 ②执行计划 ③上架文案初稿。',
    '如果您准备好了，直接告诉我您想做什么生意(比如“我想在淘宝卖茶叶”)，我就开始帮您整理需求。',
  ].join('\n');
const mockReplyForStep = (step: number, answers: string[]): string => {
  if (step === 1) {
    const found = mockDetectIntent(answers[0]);
    const direction = found ? `明白了，您要做${found.intent}。` : `明白了，我来帮您推进「${mockClip(answers[0], 20)}」。`;
    const question = found
      ? `我现在帮您准备上架资料，请告诉我具体是什么${found.thing}？`
      : '我现在帮您准备上架资料，请告诉我具体的商品是什么？';
    return `${direction}\n——— 正在整理需求 ———\n${question}`;
  }
  if (step === 2) return `好的，${mockClip(answers[1], 24) || '这个商品'}。我正在为您生成商品标题和卖点，请告诉我价格定位(就是您打算卖多少钱)，这样我能调整文案风格。`;
  if (step === 3) return `收到，${mockClip(answers[2], 20) || '这个价位'}。我正在按这个价位打磨文案风格（${mockStyleForPrice(answers[2])}），请告诉我目标客户是谁，这样卖点能更对口味。`;
  if (step === 4) return `好的，面向${mockClip(answers[3], 20) || '这类客户'}。我正在把卖点往这类人群的偏好上靠，请告诉我主要在哪些渠道销售，我好按平台调文案长度和格式。`;
  return MOCK_COMPLETED;
};
const mockApplyOverrides = (answers: string[], overrides: Record<number, string>) => {
  const effective = answers.slice();
  for (const [key, value] of Object.entries(overrides)) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0 && index < 5 && value.trim()) effective[index] = value;
  }
  return effective;
};
const mockCompileProfile = (answers: string[], overrides: Record<number, string>) => {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = mockApplyOverrides(answers, overrides);
  return {
    productName: mockClip(a2, 30), category: mockClip(a1, 20), price: mockClip(a3, 30), specs: '', sellingPoints: '',
    notes: mockClip(`需求整理:生意「${a1}」;商品「${a2}」;价格「${a3}」;客户「${a4}」;渠道「${a5}」`, 500),
  };
};
const mockCompilePlan = (answers: string[], overrides: Record<number, string>) => {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = mockApplyOverrides(answers, overrides);
  return ['【执行计划】(Mock 演示版)', `一、定位:围绕「${mockClip(a1, 30)}」,首批聚焦「${mockClip(a4, 30)}」客户。`, `二、商品:上架「${mockClip(a2, 30)}」,价格带「${mockClip(a3, 30)}」。`, `三、渠道:优先铺设「${mockClip(a5, 40)}」。`, '四、下一步:打磨上架文案初稿。'].join('\n');
};
const mockConfirmingMessage = (answers: string[], overrides: Record<number, string>) => {
  const [a1 = '', a2 = '', a3 = '', a4 = '', a5 = ''] = mockApplyOverrides(answers, overrides);
  return [
    `我理解您的需求是:在「${mockClip(a5, 24) || '待定渠道'}」卖「${mockClip(a2, 24) || '待定商品'}」(${mockClip(a1, 20) || '待定方向'})，目标客户「${mockClip(a4, 20) || '待定'}」，价格「${mockClip(a3, 20) || '待定'}」。`,
    '我准备执行以下任务:1)生成项目档案 2)生成执行计划 3)生成上架文案初稿。',
    '将交付:①项目档案 ②执行计划 ③上架文案初稿(初稿需您把关；我不能代您开店上架)。',
    `请确认开始执行。${MOCK_CONFIRM_EXAMPLE}`,
  ].join('\n');
};
const mockExecProgressMessage = (step: number) => {
  const box = (n: number, label: string) => (n <= step ? `✅ ${n}/3 ${label}已生成` : `⏳ ${n}/3 ${label}待生成`);
  const lines = ['开始执行…', box(1, '项目档案'), box(2, '执行计划'), box(3, '上架文案初稿')];
  if (step < 3) lines.push('回复“继续”执行下一步，或说“暂停”。');
  return lines.join('\n');
};
const mockCollectAnswers = (history: Message[]) => {
  let marker = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].author === 'assistant' && history[i].text.includes('正在整理需求')) { marker = i; break; }
  }
  if (marker === -1) return [];
  const before = history.slice(0, marker).filter((m) => m.author === 'user');
  const after = history.slice(marker + 1).filter((m) => m.author === 'user');
  const intent = before.length ? [before[before.length - 1]] : [];
  return [...intent, ...after].map((m) => m.text);
};

export class MockWorkbenchClient implements WorkbenchClient {
  private state = clone(initial);
  private projectSequence = 0;
  private overrides: Record<string, Record<number, string>> = {};

  async bootstrap(): Promise<WorkbenchBootstrap> { return clone(this.state); }
  async sendMessage(input: SendMessageInput): Promise<AgentTurn> {
    const project = this.state.projects.find((item) => item.conversationId === input.conversationId);
    const incoming: Message = { id: `mock-user-${Date.now()}`, author: 'user', agentId: input.agentId, text: input.text };
    const history = [...(this.state.messages[input.conversationId] ?? []), incoming];
    this.state.messages[input.conversationId] = history;
    const say = (text: string, next?: Project): AgentTurn => {
      const reply: Message = { id: `mock-${Date.now()}`, author: 'assistant', agentId: input.agentId, text };
      this.state.messages[input.conversationId] = [...history, reply];
      if (next) this.state.projects = this.state.projects.map((item) => item.id === next.id ? next : item);
      return clone({ message: reply, project: next });
    };
    if (!project) {
      return say(`这是由 Mock Client 返回的确定性界面响应：已收到“${input.text}”。`);
    }
    const answers = () => mockCollectAnswers(history);
    const overrides = () => this.overrides[project.id] ?? {};
    if (project.phase === 'done') return say(MOCK_COMPLETED, project);
    if (project.phase === 'consulting') {
      if (mockIsQuestion(input.text)) return say(mockCapabilityAnswer(mockDetectIntent(input.text)?.intent), project);
      return say(mockReplyForStep(1, [input.text]), { ...project, phase: 'collecting' });
    }
    if (project.phase === 'collecting') {
      const list = answers();
      if (list.length <= 4) return say(mockReplyForStep(list.length, list), project);
      return say(mockConfirmingMessage(list, overrides()), { ...project, phase: 'confirming' });
    }
    if (project.phase === 'confirming') {
      const correction = mockParseCorrection(input.text);
      if (correction) {
        this.overrides[project.id] = { ...overrides(), [correction.index]: correction.value };
        const list = answers();
        return say(`已更新:${MOCK_FIELD_NAMES[correction.index]} → ${correction.value}。请确认开始执行。${MOCK_CONFIRM_EXAMPLE}`, project);
      }
      if (mockIsConfirm(input.text)) {
        return say(mockExecProgressMessage(1), { ...project, phase: 'executing', profile: mockCompileProfile(answers(), overrides()) });
      }
      return say(`请先确认方案。${MOCK_CONFIRM_EXAMPLE}`, project);
    }
    const runNextStep = (): { text: string; next: Project } => {
      const current = this.state.projects.find((item) => item.id === project.id) ?? project;
      if (!current.plan) {
        return { text: mockExecProgressMessage(2), next: { ...current, plan: mockCompilePlan(answers(), overrides()) } };
      }
      const profile = mockCompileProfile(answers(), overrides());
      const draft = '【初版上架文案】(Mock 演示版)';
      return {
        text: ['信息收集完毕，执行完成！', '', draft, '', `商品:${profile.productName || '—'}｜类目:${profile.category || '—'}｜价格:${profile.price || '—'}`, '档案和计划已同步到「项目档案」卡。'].join('\n'),
        next: { ...current, phase: 'done', profile, draft },
      };
    };
    const applyMidCorrection = (correction: { index: number; value: string }): Project => {
      this.overrides[project.id] = { ...overrides(), [correction.index]: correction.value };
      const current = this.state.projects.find((item) => item.id === project.id) ?? project;
      return { ...current, profile: mockCompileProfile(answers(), this.overrides[project.id]) };
    };
    if (project.phase === 'executing') {
      const correction = mockParseCorrection(input.text);
      if (correction) return say(`已把${MOCK_FIELD_NAMES[correction.index]}改成“${correction.value}”，档案已同步。说“继续”接着执行。`, applyMidCorrection(correction));
      if (mockIsPause(input.text)) return say('已暂停，随时说“继续”接着执行，或告诉我调整。', { ...project, phase: 'paused' });
      if (mockIsContinue(input.text)) {
        const step = runNextStep();
        return say(step.text, step.next);
      }
      return say('执行中，说“继续”下一步，“暂停”休息，或直接说调整。', project);
    }
    if (project.phase === 'paused') {
      const correction = mockParseCorrection(input.text);
      if (correction) return say(`已把${MOCK_FIELD_NAMES[correction.index]}改成“${correction.value}”，档案已同步。仍处于暂停中，说“继续”接着执行。`, applyMidCorrection(correction));
      if (mockIsContinue(input.text)) {
        const step = runNextStep();
        return say(step.text, { ...step.next, phase: step.next.phase === 'done' ? 'done' : 'executing' });
      }
      return say('已暂停中。说“继续”接着执行，或告诉我调整。', project);
    }
    return say('当前状态异常，已为您回到自由咨询。', { ...project, phase: 'consulting' });
  }
  async createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
    const name = this.resolveProjectName(input);
    const id = `mock-project-${++this.projectSequence}`;
    const launch = /发布|新品|品牌|launch/i.test(`${name}\n${input.initialMessage}`);
    const avatar = defaultProjectAvatar(this.state.projects.length);
    const project: Project = { id, name, agentId: id, conversationId: `conv-${id}`, status: 'executing', template: launch ? 'launch' : 'general', avatar, phase: input.initialMessage ? 'collecting' : 'consulting' };
    const agent: AgentSummary = { id, name, role: '项目 Agent', initials: name.slice(0, 1) || '项', tone: 'project-avatar', status: 'working', preview: launch ? '正在生成内容与渠道策略' : '正在建立项目执行计划' };
    const conversation = { id: project.conversationId, agentId: id, title: name, preview: agent.preview, updatedAt: '刚刚' };
    const initialMessage: Message | undefined = input.initialMessage
      ? { id: `message-${id}`, author: 'user', agentId: id, text: input.initialMessage }
      : undefined;
    const tasks = this.workflowTasks(project);
    const artifacts = this.workflowArtifacts(project);
    const opening: Message = { id: `message-${id}-opening`, author: 'assistant', agentId: id, text: MOCK_OPENING };
    const followUp: Message = { id: `message-${id}-q2`, author: 'assistant', agentId: id, text: mockReplyForStep(1, [input.initialMessage]) };
    const messages = initialMessage ? [opening, initialMessage, followUp] : [opening];
    this.state.projects.push(project);
    this.state.tasks.push(...tasks);
    this.state.artifacts.push(...artifacts);
    this.state.agents.push(agent);
    this.state.conversations.push(conversation);
    this.state.messages[conversation.id] = messages;
    return clone({ project, agent, conversation, messages, tasks, artifacts, initialMessage });
  }

  // Mock 版只存内存,刷新就丢(和 Mock 其他数据行为一致)
  async updateProjectProfile(input: UpdateProjectProfileInput): Promise<Project> {
    const project = this.state.projects.find((item) => item.id === input.projectId);
    if (!project) throw new Error('项目不存在');
    const updated: Project = { ...project, profile: clone(input.profile) };
    this.state.projects = this.state.projects.map((item) => item.id === project.id ? updated : item);
    return clone(updated);
  }

  // Mock 冻结:共识返回空结构,不镜像后端规则
  async getConsensus(): Promise<Consensus> {
    return { version: 2, goal: null, facts: [], suggestions: [], openQuestions: [], decisions: [], history: [] };
  }

  async correctConsensus(_input: CorrectConsensusInput): Promise<Consensus> {
    return this.getConsensus();
  }

  private workflowTasks(project: Project): Task[] {
    const steps = project.template === 'launch'
      ? [['确认发布目标', '已识别项目需求与上下文'], ['建立内容与渠道策略', '正在生成传播节奏与渠道建议'], ['整理发布交付物', '等待策略确认后生成文件包']]
      : [['理解项目目标', '已读取需求与附件上下文'], ['制定执行路径', '正在生成任务拆解与优先级'], ['整理交付结果', '等待执行完成后生成文件']];
    return steps.map(([title, detail], index) => ({ id: `${project.id}-task-${index + 1}`, projectId: project.id, title, detail, status: index === 0 ? 'completed' : index === 1 ? 'running' : 'queued' }));
  }

  private workflowArtifacts(project: Project): Artifact[] {
    const files = project.template === 'launch'
      ? [['新品发布策略简报.md', '策略简报', '定位、受众与核心信息'], ['发布节奏计划.pdf', '执行计划', '渠道、时间线与责任分工']]
      : [['项目执行简报.md', '项目简报', '目标、范围与执行建议'], ['任务交付清单.pdf', '交付清单', '任务状态与后续行动']];
    return files.map(([name, kind, summary], index) => ({ id: `${project.id}-artifact-${index + 1}`, projectId: project.id, name, kind, summary, status: index === 0 ? 'ready' : 'pending' }));
  }

  private resolveProjectName(input: CreateProjectInput): string {
    if (input.name.trim()) return input.name.trim();
    const base = new Date().toISOString().slice(0, 10);
    const used = new Set(this.state.conversations.map((item) => item.title));
    if (!used.has(base)) return base;
    for (let index = 2; ; index += 1) {
      const candidate = `${base} ${String(index).padStart(2, '0')}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}
