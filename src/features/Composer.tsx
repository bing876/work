import { useState } from 'react';
import type { ConversationSummary, Message, ModelOption, WorkbenchClient } from '../client/workbench-client';
import type { Action, ShellState } from './shell-types';
import { modelAsset } from './shell-assets';
import modelChatGpt from '../assets/prototype/model-chatgpt.png';
import sendIcon from '../assets/prototype/icon-send.svg';
import tokenRing from '../assets/prototype/icon-token-ring.svg';
import voiceIcon from '../assets/prototype/icon-voice.svg';

type Props = {
  state: ShellState;
  dispatch: React.Dispatch<Action>;
  client: WorkbenchClient;
  conversation: ConversationSummary | null;
  selectedModel?: ModelOption;
};

export function Composer({ state, dispatch, client, conversation, selectedModel }: Props) {
  const [draft, setDraft] = useState('');
  const update = (patch: Partial<ShellState>) => dispatch({ type: 'set', patch });
  const send = async () => {
    if (!draft.trim() || !conversation) return;
    const local: Message = { id: `local-${Date.now()}`, author: 'user', agentId: conversation.agentId, text: draft };
    dispatch({ type: 'append', conversationId: conversation.id, message: local });
    setDraft('');
    const reply = await client.sendMessage({ conversationId: conversation.id, agentId: conversation.agentId, text: local.text, modelId: state.data.selectedModelId });
    dispatch({ type: 'agent-turn', result: reply });
  };
  return <footer className="composer" aria-label="消息输入">
    <div className="inputbar">
      <button className="inputbar-btn attach" type="button" aria-label="添加附件" onClick={() => update({ toolOpen: !state.toolOpen, modelOpen: false })}><span className="primitive-plus" aria-hidden="true" /></button>
      <textarea aria-label="输入消息" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="需要我做些什么" rows={1} />
      <button className="inputbar-btn voice" type="button" aria-label="语音输入"><img src={voiceIcon} alt="" /></button>
      <button className="inputbar-btn send" type="button" aria-label="发送消息" onClick={() => void send()}><img src={sendIcon} alt="" /></button>
      {state.toolOpen && <ToolMenu />}
    </div>
    <div className="token-outside">
      <div className="model-wrap">
        <button className="token" type="button" aria-label="选择模型" onClick={() => update({ modelOpen: !state.modelOpen, toolOpen: false })}><img className="token-ring" src={tokenRing} alt="" /><img className="token-logo" src={selectedModel ? modelAsset(selectedModel) : modelChatGpt} alt="" /></button>
        {state.modelOpen && <ModelSelector state={state} dispatch={dispatch} />}
      </div>
      <button className="circle-plus" type="button" aria-label="更多操作"><span className="primitive-plus plugin-plus" aria-hidden="true" /></button>
      <button className="circle-plus" type="button" aria-label="工作区设置" onClick={() => update({ settingsOpen: true })}><span className="primitive-plus plugin-plus" aria-hidden="true" /></button>
    </div>
  </footer>;
}

function ToolMenu() {
  const tools = [
    ['添加照片和文件', '从电脑上传'],
    ['从资料库添加', '浏览和搜索你的文件'],
    ['创建图片', '可视化呈现任何内容'],
    ['网页搜索', '查找实时新闻和信息'],
    ['深度研究', '获取详细报告'],
  ];
  return <div className="attach-popup" role="menu" aria-label="工具菜单">{tools.map(([title, description]) => <button key={title} type="button" role="menuitem"><span className="tool-icon">+</span><span><strong>{title}</strong><small>{description}</small></span></button>)}</div>;
}

function ModelSelector({ state, dispatch }: { state: ShellState; dispatch: React.Dispatch<Action> }) {
  return <div className="model-popup" role="menu" aria-label="模型选择器"><div className="mp-head">模型</div><div className="mp-list">{state.data.models.map((model) => <button key={model.id} type="button" role="menuitemradio" aria-checked={model.id === state.data.selectedModelId} onClick={() => dispatch({ type: 'set', patch: { data: { ...state.data, selectedModelId: model.id }, modelOpen: false } })}><img src={modelAsset(model)} alt="" /><span><strong>{model.name}</strong><small>{model.description}</small></span>{model.id === state.data.selectedModelId && <i>✓</i>}</button>)}</div></div>;
}
