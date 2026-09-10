import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectDossier } from './ProjectDossier';
import type { Project } from '../client/workbench-client';

const base: Project = {
  id: 'srv-1',
  name: '云南白茶',
  agentId: 'srv-1',
  conversationId: 'conv-srv-1',
  status: 'executing',
  template: 'general',
  avatar: { source: 'library', id: 'dim-star-01' },
};

describe('ProjectDossier', () => {
  it('访谈中显示进度,不显示档案', () => {
    render(<ProjectDossier project={base} userAnswerCount={2} />);
    expect(screen.getByText(/引导中…已了解 2\/5/)).toBeInTheDocument();
    expect(screen.getByText(/信息齐了就自动生成/)).toBeInTheDocument();
    expect(screen.queryByText('执行计划')).not.toBeInTheDocument();
  });

  it('完成后显示档案字段和执行计划', () => {
    render(
      <ProjectDossier
        project={{
          ...base,
          profile: { productName: '白茶礼盒', category: '茶叶', price: '99元', specs: '', sellingPoints: '', notes: '需求整理' },
          plan: '【执行计划】\n一、定位',
        }}
        userAnswerCount={5}
      />,
    );
    expect(screen.getByText('引导完成')).toBeInTheDocument();
    expect(screen.getByText('白茶礼盒')).toBeInTheDocument();
    expect(screen.getByText('执行计划', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/一、定位/)).toBeInTheDocument();
  });
});
