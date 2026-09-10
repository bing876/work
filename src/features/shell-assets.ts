import type { ModelOption, Project, WorkbenchBootstrap } from '../client/workbench-client';
import avatar1 from '../assets/prototype/avatar-1.png';
import avatar2 from '../assets/prototype/avatar-2.png';
import avatar3 from '../assets/prototype/avatar-3.png';
import avatar4 from '../assets/prototype/avatar-4.png';
import avatar5 from '../assets/prototype/avatar-5.png';
import avatar6 from '../assets/prototype/avatar-6.png';
import railContacts from '../assets/prototype/rail-contact.png';
import railFav from '../assets/prototype/rail-fav.png';
import railFiles from '../assets/prototype/rail-file.png';
import railMoments from '../assets/prototype/rail-moments.png';
import railMessages from '../assets/prototype/rail-msg.png';
import railMessagesOn from '../assets/prototype/rail-msg-on.png';
import modelChatGpt from '../assets/prototype/model-chatgpt.png';
import modelClaude from '../assets/prototype/model-claude.png';
import modelDeepSeek from '../assets/prototype/model-deepseek.png';
import modelGemini from '../assets/prototype/model-gemini.png';
import modelGrok from '../assets/prototype/model-grok.png';
import modelHunyuan from '../assets/prototype/model-hunyuan.svg';
import modelKimi from '../assets/prototype/model-kimi.png';
import modelQwen from '../assets/prototype/model-qwen.png';
import modelZhipu from '../assets/prototype/model-zhipu.png';
import { projectAvatarAsset } from '../assets/project-avatars';

export const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];

export const railItems = [
  ['消息', railMessages, railMessagesOn],
  ['联系人', railContacts],
  ['收藏', railFav],
  ['文件', railFiles],
  ['朋友圈', railMoments],
] as const;

export const modelAssets: Record<string, string> = {
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

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function modelAsset(model: ModelOption) {
  return modelAssets[model.id] ?? modelChatGpt;
}

export function projectConversations(data: WorkbenchBootstrap) {
  return data.projects.flatMap((project) => {
    const conversation = data.conversations.find((item) => item.id === project.conversationId);
    return conversation ? [{ project, conversation }] : [];
  });
}

export function avatarFor(avatar: Project['avatar']) {
  return avatar.source === 'upload' ? avatar.dataUrl : projectAvatarAsset(avatar.id);
}

export function searchState(search: string, focused: boolean) {
  return focused ? (search ? 'typing' : 'focused') : (search ? 'filled' : 'default');
}

const AVATAR_PALETTE = ['#edf1f7', '#eff5d6', '#fff0e9', '#fff4d3', '#dff8f4', '#e1f4fb'];

export function avatarPlate(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
