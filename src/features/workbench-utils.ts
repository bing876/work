import type { Project, WorkbenchBootstrap } from "../client/workbench-client";
import { projectAvatarAsset } from "../assets/project-avatars";

export function projectConversations(data: WorkbenchBootstrap, query = "") {
  const normalized = query.trim().toLocaleLowerCase();
  const conversations = new Map(data.conversations.map((item) => [item.id, item]));
  const agents = new Map(data.agents.map((item) => [item.id, item]));
  return data.projects.flatMap((project) => {
    const conversation = conversations.get(project.conversationId);
    const agent = agents.get(project.agentId);
    if (!conversation) return [];
    const searchable = [
      project.name,
      conversation.title,
      conversation.preview,
      agent?.name,
      agent?.role,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return normalized && !searchable.includes(normalized) ? [] : [{ project, conversation }];
  });
}

export function avatarFor(avatar: Project["avatar"]) {
  return avatar.source === "upload" ? avatar.dataUrl : projectAvatarAsset(avatar.id);
}

export function stableIndex(id: string, length: number) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1)
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return length ? hash % length : 0;
}
