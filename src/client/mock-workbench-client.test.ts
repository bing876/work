import { describe, expect, it } from "vitest";
import { MockWorkbenchClient } from "./mock-workbench-client";
import { defaultProjectAvatar } from "../assets/project-avatars";

const input = (overrides = {}) => ({
  name: "",
  workingFolder: null,
  initialMessage: "",
  attachments: [],
  templateEnabled: false,
  industryIntelligenceEnabled: true,
  ...overrides,
});

describe("MockWorkbenchClient createProject", () => {
  it("uses folder then date names, keeps date names unique, and preserves the first user message context", async () => {
    const client = new MockWorkbenchClient();
    const fromFolder = await client.createProject(
      input({ workingFolder: { displayName: "研究资料", mockRef: "browser-folder:研究资料" } }),
    );
    expect(fromFolder.conversation.title).toBe("研究资料");
    const first = await client.createProject(
      input({
        initialMessage: "整理项目范围",
        attachments: [
          { id: "brief", displayName: "brief.md", mimeType: "text/markdown", size: 12 },
        ],
      }),
    );
    const second = await client.createProject(input());
    const base = new Date().toISOString().slice(0, 10);
    expect(first.conversation.title).toBe(base);
    expect(second.conversation.title).toBe(`${base} 02`);
    expect(first.initialMessage).toMatchObject({
      author: "user",
      text: "整理项目范围",
      attachments: [{ displayName: "brief.md" }],
    });
  });

  it("keeps project workflow data replaceable and advances tasks and artifacts through a mock turn", async () => {
    const client = new MockWorkbenchClient();
    const project = await client.createProject(
      input({ name: "新品发布", initialMessage: "准备新品发布方案" }),
    );
    expect(project.project.avatar).toEqual(defaultProjectAvatar(1));
    expect(project.agent).not.toHaveProperty("avatar");
    expect(project.project.template).toBe("launch");
    expect(project.tasks.map((task) => task.status)).toEqual(["completed", "running", "queued"]);
    expect(project.artifacts.map((artifact) => artifact.status)).toEqual(["ready", "pending"]);
    const turn = await client.sendMessage({
      conversationId: project.conversation.id,
      agentId: project.agent.id,
      text: "继续执行",
      modelId: "chatgpt",
    });
    expect(turn.project?.status).toBe("completed");
    expect(turn.tasks?.every((task) => task.status === "completed")).toBe(true);
    expect(turn.artifacts?.every((artifact) => artifact.status === "ready")).toBe(true);
  });

  it("keeps an uploaded avatar when one is supplied at creation", async () => {
    const client = new MockWorkbenchClient();
    const avatar = {
      source: "upload" as const,
      name: "avatar.png",
      mimeType: "image/png",
      size: 6,
      dataUrl: "data:image/png;base64,YXZhdGFy",
    };
    const project = await client.createProject(input({ avatar }));
    expect(project.project.avatar).toEqual(avatar);
  });
});
