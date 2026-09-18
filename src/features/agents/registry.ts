import type { AgentDefinition, AgentId } from './types';

export class AgentRegistry {
  private readonly agents = new Map<AgentId, AgentDefinition>();

  constructor(initialAgents: AgentDefinition[] = []) {
    initialAgents.forEach((agent) => this.register(agent));
  }

  register(agent: AgentDefinition): void {
    if (!agent.id.trim()) throw new Error('Agent id is required');
    this.agents.set(agent.id, agent);
  }

  get(id: AgentId): AgentDefinition | undefined { return this.agents.get(id); }
  list(): AgentDefinition[] { return [...this.agents.values()]; }
  remove(id: AgentId): boolean { return this.agents.delete(id); }
}

export const defaultAgents: AgentDefinition[] = [
  { id: 'planner', name: '规划智能体', description: '拆解复杂任务并制定执行步骤', modelId: '' },
  { id: 'researcher', name: '研究智能体', description: '收集信息并分析事实', modelId: '' },
  { id: 'writer', name: '写作智能体', description: '整合结果并生成最终答复', modelId: '' },
];
