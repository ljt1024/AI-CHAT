import { useCallback, useEffect, useState } from 'react';
import type { AgentDefinition, AgentResult } from '../types';
import { fetchAgents, runAgents, type AgentRequest } from '../api';

export function useAgents() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<AgentResult | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchAgents(controller.signal).then(setAgents).catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, []);
  const execute = useCallback(async (request: AgentRequest, signal?: AbortSignal) => {
    setError(null);
    setIsRunning(true);
    try { const result = await runAgents(request, signal); setRun(result); return result; }
    catch (error) { setError(error instanceof Error ? error.message : '智能体执行失败'); throw error; }
    finally { setIsRunning(false); }
  }, []);
  return { agents, isLoading, isRunning, error, run, execute };
}
