import { useEffect, useMemo, useReducer } from "react";
import { useWorkbenchClient } from "./workbench-context";
import type { CreateProjectInput, WorkbenchBootstrap } from "../client/workbench-client";
import { AppShell } from "../features/AppShell";
import type { Action, AppState } from "../features/workbench-types";

const reducer = (state: AppState, action: Action): AppState => {
  if (action.type === "boot")
    return { ...state, data: action.data, conversationId: action.data.conversations[0]?.id ?? "" };
  if (action.type === "set") return { ...state, ...action.patch };
  if (action.type === "append" && state.data)
    return {
      ...state,
      data: {
        ...state.data,
        messages: {
          ...state.data.messages,
          [action.conversationId]: [
            ...(state.data.messages[action.conversationId] ?? []),
            action.message,
          ],
        },
      },
    };
  if (action.type === "project" && state.data) {
    const { project, agent, conversation, messages, tasks, artifacts } = action.result;
    return {
      ...state,
      conversationId: conversation.id,
      createProjectDialogOpen: false,
      data: {
        ...state.data,
        projects: [...state.data.projects, project],
        tasks: [...state.data.tasks, ...tasks],
        artifacts: [...state.data.artifacts, ...artifacts],
        agents: [...state.data.agents, agent],
        conversations: [...state.data.conversations, conversation],
        messages: { ...state.data.messages, [conversation.id]: messages },
      },
    };
  }
  if (action.type === "agent-turn" && state.data) {
    const { message, project, tasks, artifacts } = action.result;
    return {
      ...state,
      data: {
        ...state.data,
        projects: project
          ? state.data.projects.map((item) => (item.id === project.id ? project : item))
          : state.data.projects,
        tasks: tasks
          ? state.data.tasks.map((item) => tasks.find((next) => next.id === item.id) ?? item)
          : state.data.tasks,
        artifacts: artifacts
          ? state.data.artifacts.map(
              (item) => artifacts.find((next) => next.id === item.id) ?? item,
            )
          : state.data.artifacts,
        messages: {
          ...state.data.messages,
          [state.conversationId]: [...(state.data.messages[state.conversationId] ?? []), message],
        },
      },
    };
  }
  return state;
};

export function App({ initialData = null }: { initialData?: WorkbenchBootstrap | null }) {
  const client = useWorkbenchClient();
  const [state, dispatch] = useReducer(reducer, {
    data: initialData,
    conversationId: initialData?.conversations[0]?.id ?? "",
    selectedModelId: "chatgpt",
    search: "",
    searchFocused: false,
    sidebarWidth: 250,
    collapsed: false,
    toolOpen: false,
    modelOpen: false,
    createProjectDialogOpen: false,
    settingsOpen: false,
  });
  useEffect(() => {
    if (initialData) return;
    let active = true;
    void client.bootstrap().then((data) => {
      if (active) dispatch({ type: "boot", data });
    });
    return () => {
      active = false;
    };
  }, [client, initialData]);
  const selectedConversation = useMemo(
    () => state.data?.conversations.find((item) => item.id === state.conversationId) ?? null,
    [state.data, state.conversationId],
  );
  if (!state.data) return <main className="loading-shell">Loading Workbench vNext…</main>;
  const createProject = async (input: CreateProjectInput) =>
    dispatch({ type: "project", result: await client.createProject(input) });
  return (
    <AppShell
      state={{ ...state, data: state.data }}
      dispatch={dispatch}
      client={client}
      selectedConversation={selectedConversation}
      onCreateProject={createProject}
    />
  );
}
