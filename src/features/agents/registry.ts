import { t } from '@/app/i18n';
import type { AgentDefinition, AgentId } from './types';

export class AgentRegistry {
  private readonly agents = new Map<AgentId, AgentDefinition>();

  constructor(initialAgents: AgentDefinition[] = []) {
    initialAgents.forEach((agent) => this.register(agent));
  }

  register(agent: AgentDefinition): void {
    if (!agent.id.trim()) throw new Error(t('error.agentId'));
    this.agents.set(agent.id, agent);
  }

  get(id: AgentId): AgentDefinition | undefined { return this.agents.get(id); }
  list(): AgentDefinition[] { return [...this.agents.values()]; }
  remove(id: AgentId): boolean { return this.agents.delete(id); }
}

export const defaultAgents: AgentDefinition[] = [
  { id: 'planner', get name() { return t('agent.planner.name'); }, get description() { return t('agent.planner.description'); }, modelId: '' },
  { id: 'researcher', get name() { return t('agent.researcher.name'); }, get description() { return t('agent.researcher.description'); }, modelId: '' },
  { id: 'writer', get name() { return t('agent.writer.name'); }, get description() { return t('agent.writer.description'); }, modelId: '' },
];
