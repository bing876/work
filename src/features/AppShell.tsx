import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { Copy } from "@phosphor-icons/react/Copy";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import type {
  AgentSummary,
  Artifact,
  ConversationSummary,
  Message,
  ModelOption,
  Project,
  Task,
  WorkbenchClient,
} from "../client/workbench-client";
import avatar1 from "../assets/prototype/avatar-1.webp";
import avatar2 from "../assets/prototype/avatar-2.webp";
import avatar3 from "../assets/prototype/avatar-3.webp";
import avatar4 from "../assets/prototype/avatar-4.webp";
import avatar5 from "../assets/prototype/avatar-5.webp";
import avatar6 from "../assets/prototype/avatar-6.webp";
import railContacts from "../assets/prototype/rail-contact.png";
import railFav from "../assets/prototype/rail-fav.png";
import railFiles from "../assets/prototype/rail-file.png";
import railMoments from "../assets/prototype/rail-moments.png";
import railMessages from "../assets/prototype/rail-msg.png";
import railMessagesOn from "../assets/prototype/rail-msg-on.png";
import modelChatGpt from "../assets/prototype/model-chatgpt.png";
import modelClaude from "../assets/prototype/model-claude.png";
import modelDeepSeek from "../assets/prototype/model-deepseek.png";
import modelGemini from "../assets/prototype/model-gemini.png";
import modelGrok from "../assets/prototype/model-grok.png";
import modelHunyuan from "../assets/prototype/model-hunyuan.svg";
import modelKimi from "../assets/prototype/model-kimi.png";
import modelQwen from "../assets/prototype/model-qwen.png";
import modelZhipu from "../assets/prototype/model-zhipu.png";
import searchIcon from "../assets/prototype/icon-search.svg";
import sendIcon from "../assets/prototype/icon-send.svg";
import tokenRing from "../assets/prototype/icon-token-ring.svg";
import voiceIcon from "../assets/prototype/icon-voice.svg";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { avatarFor, projectConversations, stableIndex } from "./workbench-utils";
import type { Action, AppShellProps, ShellState } from "./workbench-types";

const SettingsDialog = lazy(() => import("./SettingsDialog"));

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
const railItems = [
  ["消息", railMessages, railMessagesOn],
  ["联系人", railContacts],
  ["收藏", railFav],
  ["文件", railFiles],
  ["朋友圈", railMoments],
] as const;
const modelAssets: Record<string, string> = {
  chatgpt: modelChatGpt,
  claude: modelClaude,
  deepseek: modelDeepSeek,
  gemini: modelGemini,
  grok: modelGrok,
  hunyuan: modelHunyuan,
  kimi: modelKimi,
  qwen: modelQwen,
  zhipu: modelZhipu,
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function modelAsset(model: ModelOption) {
  return modelAssets[model.id] ?? modelChatGpt;
}

export function AppShell({
  state,
  dispatch,
  client,
  selectedConversation,
  onCreateProject,
}: AppShellProps) {
  const frameRef = useRef<HTMLElement>(null);
  const modeTimerRef = useRef<number | null>(null);
  const [modeTransition, setModeTransition] = useState<"entering" | "leaving" | null>(null);
  const sidebarWidth = clamp(state.sidebarWidth, 250, 310);
  const update = (patch: Partial<ShellState>) => dispatch({ type: "set", patch });
  const conversation = selectedConversation;
  const agent =
    state.data.agents.find((item) => item.id === conversation?.agentId) ?? state.data.agents[0];
  const project = state.data.projects.find((item) => item.conversationId === conversation?.id);
  const selectedModel =
    state.data.models.find((item) => item.id === state.selectedModelId) ?? state.data.models[0];
  const projects = useMemo(() => projectConversations(state.data), [state.data]);
  const filteredProjects = useMemo(
    () => projectConversations(state.data, state.search),
    [state.data, state.search],
  );
  const agents = useMemo(
    () => new Map(state.data.agents.map((item) => [item.id, item])),
    [state.data.agents],
  );

  useEffect(
    () => () => {
      if (modeTimerRef.current !== null) window.clearTimeout(modeTimerRef.current);
    },
    [],
  );

  function setSwitcher(open: boolean) {
    if (modeTimerRef.current !== null) window.clearTimeout(modeTimerRef.current);
    setModeTransition(open ? "entering" : "leaving");
    update({ collapsed: open });
    modeTimerRef.current = window.setTimeout(() => setModeTransition(null), open ? 480 : 620);
  }

  function resizeSidebar(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== undefined && event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic pointers have no active capture */
    }
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let resizing = true;
    const end = () => {
      resizing = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
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
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function resizeSidebarByKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 1 : 10;
    const next =
      event.key === "ArrowLeft"
        ? sidebarWidth - step
        : event.key === "ArrowRight"
          ? sidebarWidth + step
          : event.key === "Home"
            ? 250
            : event.key === "End"
              ? 310
              : null;
    if (next === null) return;
    event.preventDefault();
    update({ sidebarWidth: clamp(next, 250, 310) });
  }

  const showSwitcher = state.collapsed || modeTransition === "leaving";
  const showTabs = !state.collapsed || modeTransition === "entering";

  return (
    <main className="workbench-stage" data-testid="workbench-stage">
      <section
        ref={frameRef}
        className={`frame ${state.collapsed ? "collapsed agent" : ""} ${modeTransition ?? ""} ${modeTransition ? "animating" : ""}`}
        style={
          { "--sidebar-width": `${state.collapsed ? 0 : sidebarWidth}px` } as React.CSSProperties
        }
        aria-label="XYZ Workbench vNext"
      >
        <nav className="rail" aria-label="主导航">
          <button
            className="menu-btn"
            type="button"
            aria-label={state.collapsed ? "退出 Agent Switcher" : "进入 Agent Switcher"}
            aria-pressed={state.collapsed}
            onClick={() => setSwitcher(!state.collapsed)}
          >
            <span className="rail-user-avatar">{state.data.user.initials}</span>
          </button>
          {showTabs && (
            <div className="rail-tabs" aria-hidden={state.collapsed}>
              {railItems.map(([label, asset, selectedAsset], index) => (
                <button
                  key={label}
                  className={`tab tab-${["msg", "contact", "fav", "file", "moments"][index]} ${index === 0 ? "selected" : ""}`}
                  type="button"
                  aria-label={label}
                  tabIndex={state.collapsed ? -1 : 0}
                >
                  <img className="tab-icon-off" src={asset} alt="" />
                  {selectedAsset && <img className="tab-icon-on" src={selectedAsset} alt="" />}
                </button>
              ))}
            </div>
          )}
          {showSwitcher && (
            <div
              className="rail-agent-list"
              aria-label="项目与智能体"
              aria-hidden={!state.collapsed}
            >
              {projects.map(({ project, conversation: target }) => {
                const selected = target.id === state.conversationId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`rail-agent-avatar ${selected ? "selected" : ""}`}
                    aria-label={project.name}
                    aria-pressed={selected}
                    tabIndex={state.collapsed ? 0 : -1}
                    onClick={() => update({ conversationId: target.id })}
                  >
                    <img src={avatarFor(project.avatar)} alt="" loading="lazy" />
                  </button>
                );
              })}
              <button
                className="rail-quick-add"
                type="button"
                aria-label="创建项目"
                tabIndex={state.collapsed ? 0 : -1}
                onClick={() => update({ createProjectDialogOpen: true })}
              >
                <span className="primitive-plus" aria-hidden="true" />
              </button>
            </div>
          )}
          {!state.collapsed && (
            <button
              className="hamburger-btn"
              type="button"
              aria-label="设置"
              onClick={() => update({ settingsOpen: true })}
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </nav>

        <aside className="sidebar" aria-label="上下文和会话">
          <div className="sidebar-tools">
            <label
              className="search-pill"
              data-state={searchState(state.search, state.searchFocused)}
            >
              <img className="search-icon" src={searchIcon} alt="" />
              <input
                aria-label="搜索联系人"
                value={state.search}
                onFocus={() => update({ searchFocused: true })}
                onBlur={() => update({ searchFocused: false })}
                onChange={(event) => update({ search: event.target.value })}
                placeholder="搜索"
              />
              {state.search && (
                <button
                  className="search-clear"
                  type="button"
                  aria-label="清空搜索"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => update({ search: "" })}
                />
              )}
            </label>
            <button
              className="add-btn"
              type="button"
              aria-label="创建项目"
              onClick={() => update({ createProjectDialogOpen: true })}
            >
              <span className="primitive-plus" aria-hidden="true" />
            </button>
          </div>
          <div className="contact-list">
            {filteredProjects.map(({ project, conversation }) => (
              <ContactRow
                key={project.id}
                conversation={conversation}
                agent={agents.get(project.agentId)}
                avatar={avatarFor(project.avatar)}
                selected={conversation.id === state.conversationId}
                onClick={() => update({ conversationId: conversation.id })}
              />
            ))}
          </div>
        </aside>
        <div
          className="splitter"
          role="separator"
          tabIndex={state.collapsed ? -1 : 0}
          aria-hidden={state.collapsed}
          aria-orientation="vertical"
          aria-label="调整侧边栏宽度"
          aria-valuemin={250}
          aria-valuemax={310}
          aria-valuenow={sidebarWidth}
          onPointerDown={resizeSidebar}
          onKeyDown={resizeSidebarByKeyboard}
          onDoubleClick={() => update({ sidebarWidth: 250 })}
        />

        <section className="main-area" aria-label="工作区">
          <Conversation
            messages={state.data.messages[state.conversationId] ?? []}
            agent={agent}
            project={project}
            tasks={state.data.tasks.filter((item) => item.projectId === project?.id)}
            artifacts={state.data.artifacts.filter((item) => item.projectId === project?.id)}
          />
          <Composer
            state={state}
            dispatch={dispatch}
            client={client}
            conversation={conversation}
            selectedModel={selectedModel}
          />
        </section>
        {state.createProjectDialogOpen && (
          <CreateProjectDialog
            onClose={() => update({ createProjectDialogOpen: false })}
            onCreate={onCreateProject}
          />
        )}
      </section>
      <Suspense fallback={null}>
        {state.settingsOpen && <SettingsDialog onClose={() => update({ settingsOpen: false })} />}
      </Suspense>
    </main>
  );
}

function searchState(search: string, focused: boolean) {
  return focused ? (search ? "typing" : "focused") : search ? "filled" : "default";
}

const AVATAR_PALETTE = ["#edf1f7", "#eff5d6", "#fff0e9", "#fff4d3", "#dff8f4", "#e1f4fb"];
function avatarPlate(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function ContactRow({
  conversation,
  agent,
  avatar,
  selected,
  onClick,
}: {
  conversation: ConversationSummary;
  agent: AgentSummary | undefined;
  avatar: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`contact-item ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <img
        className="contact-avatar"
        src={avatar}
        alt=""
        loading="lazy"
        style={{ "--avatar-plate": avatarPlate(conversation.id) } as React.CSSProperties}
      />
      <span className="contact-body">
        <span className="contact-line">
          <strong>{conversation.title}</strong>
          <time>{conversation.updatedAt}</time>
        </span>
        <span className="contact-preview">{conversation.preview}</span>
      </span>
    </button>
  );
}

function Conversation({
  messages,
  agent,
  project,
  tasks,
  artifacts,
}: {
  messages: Message[];
  agent: AgentSummary | undefined;
  project: Project | undefined;
  tasks: Task[];
  artifacts: Artifact[];
}) {
  if (!messages.length)
    return <section className="chat-area empty-conversation" aria-label="空白对话" />;
  return (
    <section className="chat-area" aria-label="对话">
      {project && <ProjectExperience project={project} tasks={tasks} artifacts={artifacts} />}
      {messages.map((message) => (
        <MessageView key={message.id} message={message} agent={agent} />
      ))}
    </section>
  );
}

function ProjectExperience({
  project,
  tasks,
  artifacts,
}: {
  project: Project;
  tasks: Task[];
  artifacts: Artifact[];
}) {
  const status =
    project.status === "completed" ? "已完成" : project.status === "planning" ? "规划中" : "执行中";
  const taskStatus = (value: Task["status"]) =>
    value === "completed" ? "已完成" : value === "running" ? "执行中" : "待执行";
  return (
    <section className="project-experience" aria-label="项目执行状态">
      <header>
        <span>
          <b>{project.template === "launch" ? "新品发布工作流" : "项目工作流"}</b>
          <small>{project.name}</small>
        </span>
        <em data-state={project.status}>{status}</em>
      </header>
      <div className="experience-section">
        <strong>任务执行</strong>
        {tasks.map((task) => (
          <div className="task-row" key={task.id}>
            <span>
              <b>{task.title}</b>
              <small>{task.detail}</small>
            </span>
            <em data-state={task.status}>{taskStatus(task.status)}</em>
          </div>
        ))}
      </div>
      <div className="experience-section">
        <strong>文件结果</strong>
        {artifacts.map((artifact) => (
          <div className="artifact-row" key={artifact.id} data-ready={artifact.status === "ready"}>
            <span>
              <b>{artifact.name}</b>
              <small>
                {artifact.kind} · {artifact.summary}
              </small>
            </span>
            <em>{artifact.status === "ready" ? "已就绪" : "生成中"}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function MessageView({ message, agent }: { message: Message; agent: AgentSummary | undefined }) {
  const mine = message.author === "user";
  return (
    <article className={`message ${mine ? "user" : "assistant"}`}>
      {!mine && (
        <img
          className="message-avatar"
          src={avatars[stableIndex(agent?.id ?? message.agentId, avatars.length)]}
          alt=""
          loading="lazy"
        />
      )}
      <div className="message-content">
        {!mine && <strong className="message-sender">{agent?.name ?? "XYZ"}</strong>}
        <p className="message-bubble">{message.text}</p>
        {!!message.attachments?.length && (
          <div className="message-attachments">
            {message.attachments.map((attachment) => (
              <span key={attachment.id}>{attachment.displayName}</span>
            ))}
          </div>
        )}
        {mine && (
          <div className="user-msg-actions">
            <button aria-label="复制消息" type="button">
              <Copy size={15} />
            </button>
            <button aria-label="编辑消息" type="button">
              <PencilSimple size={15} />
            </button>
          </div>
        )}
        {!mine && (
          <div className="assistant-actions">
            <button aria-label="复制结果" type="button">
              <Copy size={15} />
            </button>
            <button aria-label="重新生成" type="button">
              <ArrowClockwise size={15} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Composer({
  state,
  dispatch,
  client,
  conversation,
  selectedModel,
}: {
  state: ShellState;
  dispatch: React.Dispatch<Action>;
  client: WorkbenchClient;
  conversation: ConversationSummary | null;
  selectedModel: ModelOption | undefined;
}) {
  const [draft, setDraft] = useState("");
  const update = (patch: Partial<ShellState>) => dispatch({ type: "set", patch });
  const send = async () => {
    if (!draft.trim() || !conversation) return;
    const local: Message = {
      id: `local-${Date.now()}`,
      author: "user",
      agentId: conversation.agentId,
      text: draft,
    };
    dispatch({ type: "append", conversationId: conversation.id, message: local });
    setDraft("");
    const reply = await client.sendMessage({
      conversationId: conversation.id,
      agentId: conversation.agentId,
      text: local.text,
      modelId: state.selectedModelId,
    });
    dispatch({ type: "agent-turn", result: reply });
  };
  return (
    <footer className="composer" aria-label="消息输入">
      <div className="inputbar">
        <button
          className="inputbar-btn attach"
          type="button"
          aria-label="添加附件"
          onClick={() => update({ toolOpen: !state.toolOpen, modelOpen: false })}
        >
          <span className="primitive-plus" aria-hidden="true" />
        </button>
        <textarea
          aria-label="输入消息"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="需要我做些什么"
          rows={1}
        />
        <button className="inputbar-btn voice" type="button" aria-label="语音输入">
          <img src={voiceIcon} alt="" />
        </button>
        <button
          className="inputbar-btn send"
          type="button"
          aria-label="发送消息"
          onClick={() => void send()}
        >
          <img src={sendIcon} alt="" />
        </button>
        {state.toolOpen && <ToolMenu />}
      </div>
      <div className="token-outside">
        <div className="model-wrap">
          <button
            className="token"
            type="button"
            aria-label="选择模型"
            onClick={() => update({ modelOpen: !state.modelOpen, toolOpen: false })}
          >
            <img className="token-ring" src={tokenRing} alt="" />
            <img
              className="token-logo"
              src={selectedModel ? modelAsset(selectedModel) : modelChatGpt}
              alt=""
            />
          </button>
          {state.modelOpen && <ModelSelector state={state} dispatch={dispatch} />}
        </div>
        <button className="circle-plus" type="button" aria-label="更多操作">
          <span className="primitive-plus plugin-plus" aria-hidden="true" />
        </button>
        <button
          className="circle-plus"
          type="button"
          aria-label="工作区设置"
          onClick={() => update({ settingsOpen: true })}
        >
          <span className="primitive-plus plugin-plus" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}

function ToolMenu() {
  const tools = [
    ["添加照片和文件", "从电脑上传"],
    ["从资料库添加", "浏览和搜索你的文件"],
    ["创建图片", "可视化呈现任何内容"],
    ["网页搜索", "查找实时新闻和信息"],
    ["深度研究", "获取详细报告"],
  ];
  return (
    <div className="attach-popup" role="menu" aria-label="工具菜单">
      {tools.map(([title, description]) => (
        <button key={title} type="button" role="menuitem">
          <span className="tool-icon">+</span>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function ModelSelector({
  state,
  dispatch,
}: {
  state: ShellState;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="model-popup" role="menu" aria-label="模型选择器">
      <div className="mp-head">模型</div>
      <div className="mp-list">
        {state.data.models.map((model) => (
          <button
            key={model.id}
            type="button"
            role="menuitemradio"
            aria-checked={model.id === state.selectedModelId}
            onClick={() =>
              dispatch({ type: "set", patch: { selectedModelId: model.id, modelOpen: false } })
            }
          >
            <img src={modelAsset(model)} alt="" />
            <span>
              <strong>{model.name}</strong>
              <small>{model.description}</small>
            </span>
            {model.id === state.selectedModelId && <i>✓</i>}
          </button>
        ))}
      </div>
    </div>
  );
}
