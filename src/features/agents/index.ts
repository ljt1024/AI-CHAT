export * from './types';
export * from './registry';
export * from './orchestrator';
export * from './api';
export * from './hooks/useAgents';

/** Reserved boundary for multi-agent orchestration, routing, and tool execution. */
export interface AgentOrchestrator {
  run(input: string, agents: import('./types').AgentDefinition[]): Promise<import('./types').AgentRun>;
}
