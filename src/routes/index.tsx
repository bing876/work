import { createFileRoute } from "@tanstack/react-router";
import { App } from "../app/App";
import { WorkbenchClientProvider } from "../app/workbench-context";
import { MockWorkbenchClient } from "../client/mock-workbench-client";

export const Route = createFileRoute("/")({
  loader: () => client.bootstrap(),
  head: () => ({
    meta: [
      { title: "XYZ Workbench — AI 项目工作台" },
      { name: "description", content: "在统一工作台中管理 AI 项目、会话、任务与交付文件。" },
      { property: "og:title", content: "XYZ Workbench — AI 项目工作台" },
      { property: "og:description", content: "在统一工作台中管理 AI 项目、会话、任务与交付文件。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const client = new MockWorkbenchClient();

function Index() {
  const initialData = Route.useLoaderData();
  return (
    <WorkbenchClientProvider client={client}>
      <App initialData={initialData} />
    </WorkbenchClientProvider>
  );
}
