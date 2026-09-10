import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectDossier, countAnswers } from './ProjectDossier';
import type { Message, Project } from '../client/workbench-client';

const base: Project = {
  id: 'srv-1',
  name: '云南白茶',
  agentId: 'srv-1',
  conversationId: 'conv-srv-1',
  status: 'executing',
  template: 'general',
  avatar: { source: 'library', id: 'dim-star-01' },
  phase: 'collecting',
};

const um = (id: string, text: string): Message => ({ id, author: 'user', agentId: 'srv-1', text });
const am = (id: string, text: string): Message => ({ id, author: 'assistant', agentId: 'srv-1', text });

describe('countAnswers', () => {
  it('咨询闲聊不计入,只数标记后的回答', () => {
    const messages = [
      am('m1', '您好！'),
      um('m2', '你能做什么？'),
      am('m3', '我能为您做什么…'),
      um('m4', '我想卖茶叶'),
      am('m5', '明白了…——— 正在整理需求 ———…'),
      um('m6', '云南白茶'),
    ];
    expect(countAnswers(messages)).toBe(2);
    expect(countAnswers([am('m1', '您好！')] as Message[])).toBe(0);
  });
});

describe('ProjectDossier', () => {
  it('咨询阶段显示徽标和示例', () => {
    render(<ProjectDossier project={{ ...base, phase: 'consulting' }} messages={[am('m1', '您好！')]} />);
    expect(screen.getByText('自由咨询中')).toBeInTheDocument();
    expect(screen.getByText(/我想在淘宝卖茶叶/)).toBeInTheDocument();
  });

  it('收集阶段显示进度', () => {
    render(
      <ProjectDossier
        project={base}
        messages={[am('m1', '您好'), um('m2', '卖茶'), am('m3', '——— 正在整理需求 ———'), um('m4', '白茶'), um('m5', '99元')]}
      />,
    );
    expect(screen.getByText(/正在整理需求…已了解 3\/5/)).toBeInTheDocument();
  });

  it('确认阶段显示等待确认和修改示例', () => {
    render(<ProjectDossier project={{ ...base, phase: 'confirming' }} messages={[]} />);
    expect(screen.getByText('等待确认')).toBeInTheDocument();
    expect(screen.getByText(/价格改成199元/)).toBeInTheDocument();
  });

  it('执行中显示 x/3 进度,档案渐进展示', () => {
    render(
      <ProjectDossier
        project={{
          ...base,
          phase: 'executing',
          profile: { productName: '白茶礼盒', category: '茶叶', price: '99元', specs: '', sellingPoints: '', notes: '需求整理' },
        }}
        messages={[]}
      />,
    );
    expect(screen.getByText(/执行中 1\/3/)).toBeInTheDocument();
    expect(screen.getByText('白茶礼盒')).toBeInTheDocument();
    expect(screen.queryByText('执行计划', { selector: 'strong' })).not.toBeInTheDocument();
  });

  it('完成后显示档案和计划,不再显示示例', () => {
    render(
      <ProjectDossier
        project={{
          ...base,
          phase: 'done',
          profile: { productName: '白茶礼盒', category: '茶叶', price: '99元', specs: '', sellingPoints: '', notes: '需求整理' },
          plan: '【执行计划】\n一、定位',
          draft: '【初版上架文案】',
        }}
        messages={[]}
      />,
    );
    expect(screen.getByText('引导完成')).toBeInTheDocument();
    expect(screen.getByText('执行计划', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(/您可以这样说/)).not.toBeInTheDocument();
  });
});
