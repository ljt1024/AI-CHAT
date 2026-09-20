import { t, languageHeaders } from '@/app/i18n';
import type { AgentDefinition, AgentEvent, AgentResult } from './types';
import { getFileDownloadUrl } from '@/shared/utils/fileDownloads';

const apiUrl = (path: string) => {
  const chatUrl = import.meta.env.VITE_CHAT_BASE_URL || '/api/chat/completions';
  return new URL(`/api${path}`, new URL(chatUrl, window.location.origin)).toString();
};

async function readError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => ({}));
  return new Error(payload.msg || payload.error?.message || t('error.status', { status: response.status }));
}

export async function fetchAgents(signal?: AbortSignal): Promise<AgentDefinition[]> {
  const response = await fetch(apiUrl('/agents'), { signal, headers: languageHeaders() });
  if (!response.ok) throw await readError(response);
  return (await response.json()).data;
}

export async function downloadAgentArtifact(fileId: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^[a-f0-9-]{36}$/i.test(fileId)) throw new Error(t('error.invalidFile'));
  const response = await fetch(getFileDownloadUrl(fileId), { signal, headers: languageHeaders() });
  if (!response.ok) throw await readError(response);
  return response.blob();
}

export interface AgentRequest {
  input: string;
  sessionId: string;
  agentIds?: string[];
  model?: string;
  turnId?: string;
}

export async function runAgents(request: AgentRequest, signal?: AbortSignal): Promise<AgentResult> {
  const response = await fetch(apiUrl('/agents/run'), {
    method: 'POST', headers: { ...languageHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal,
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()).data;
}

export async function streamAgents(request: AgentRequest, onEvent: (event: AgentEvent) => void, signal?: AbortSignal): Promise<void> {
  const response = await fetch(apiUrl('/agents/run'), {
    method: 'POST', signal,
    headers: { ...languageHeaders(), 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ ...request, stream: true }),
  });
  if (!response.ok) throw await readError(response);
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error(t('error.noStream'));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const parse = (block: string) => {
    const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    const event = JSON.parse(data) as AgentEvent;
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'done') completed = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        parse(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (done) break;
    }
    if (buffer.trim()) parse(buffer);
    if (!completed) throw new Error(t('error.incompleteStream'));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
