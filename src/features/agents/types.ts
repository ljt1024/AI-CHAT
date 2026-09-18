export type AgentId = string;

export interface AgentDefinition {
  id: AgentId;
  name: string;
  description?: string;
  modelId: string;
  systemPrompt?: string;
  tools?: string[];
}

export interface AgentTask {
  id: string;
  input: string;
  agentId: AgentId;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AgentRun {
  id: string;
  taskId: string;
  steps: Array<{ agentId: AgentId; output?: string; status: AgentTask['status'] }>;
}

export type AgentExecutor = (agent: AgentDefinition, input: string, signal?: AbortSignal) => Promise<string>;

export type OrchestrationStrategy = 'sequential' | 'parallel';

export interface AgentStep {
  stage?: 'preparing' | 'executing';
  id: string;
  phase: 'thought' | 'action' | 'observation';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  agentId?: string;
  toolCallId?: string;
  output: string;
}

export interface AgentResult {
  id: string;
  sessionId: string;
  input: string;
  output: string;
  steps: AgentStep[];
  memoryMessages: number;
}

export type AgentEvent =
  | { type: 'start'; sessionId: string; memoryMessages: number }
  | { type: 'memory'; summarizedMessages: number; recentMessages: number }
  | { type: 'step'; step: AgentStep }
  | { type: 'step_delta'; stepId: string; text: string; reset?: boolean }
  | { type: 'answer_start' }
  | { type: 'delta'; text: string }
  | { type: 'done'; result: AgentResult }
  | { type: 'error'; message: string; requestId?: string };
