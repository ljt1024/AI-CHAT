import { t } from '@/app/i18n';
import { v4 as uuidv4 } from 'uuid';
import type { AgentDefinition, AgentExecutor, AgentRun, AgentTask, OrchestrationStrategy } from './types';

export async function orchestrate(
  input: string,
  agents: AgentDefinition[],
  executor: AgentExecutor,
  options: { strategy?: OrchestrationStrategy; signal?: AbortSignal } = {},
): Promise<AgentRun> {
  if (!agents.length) throw new Error(t('error.noAgents'));
  const task: AgentTask = { id: uuidv4(), input, agentId: agents[0].id, status: 'running' };
  const strategy = options.strategy ?? 'sequential';
  const steps = strategy === 'parallel'
    ? await Promise.all(agents.map(async (agent) => runStep(agent, input, executor, options.signal)))
    : await runSequential(agents, input, executor, options.signal);
  task.status = steps.some((step) => step.status === 'failed') ? 'failed' : 'completed';
  return { id: uuidv4(), taskId: task.id, steps };
}

async function runSequential(agents: AgentDefinition[], input: string, executor: AgentExecutor, signal?: AbortSignal) {
  const steps: AgentRun['steps'] = [];
  let context = input;
  for (const agent of agents) {
    const step = await runStep(agent, context, executor, signal);
    steps.push(step);
    if (step.status === 'failed') break;
    context = step.output ?? context;
  }
  return steps;
}

async function runStep(agent: AgentDefinition, input: string, executor: AgentExecutor, signal?: AbortSignal): Promise<AgentRun['steps'][number]> {
  try { return { agentId: agent.id, output: await executor(agent, input, signal), status: 'completed' }; }
  catch (error) { return { agentId: agent.id, output: error instanceof Error ? error.message : t('error.agent'), status: 'failed' }; }
}
