import { useState } from 'react';
import { useLanguage } from '@/app/providers/LanguageContext';
import type { AgentStep } from '../types';
import './AgentTrace.css';

export function AgentTrace({ steps, status, memoryMessages = 0, summarizedMessages = 0 }: {
  steps: AgentStep[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  memoryMessages?: number;
  summarizedMessages?: number;
}) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(true);
  const zh = language === 'zh';
  const phases = zh ? { thought: '思考', action: '行动', observation: '观察' } : { thought: 'Plan', action: 'Action', observation: 'Observation' };
  const statuses = zh ? { running: '正在解决', completed: '已完成', failed: '执行失败', cancelled: '已停止' } : { running: 'Working', completed: 'Completed', failed: 'Failed', cancelled: 'Stopped' };
  return <details className={`agent-trace agent-trace--${status}`} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span className="agent-status-dot" /><strong>{zh ? '智能体' : 'Agent'}</strong><span role="status">{statuses[status]}</span><small>{steps.length} {zh ? '步' : 'steps'}</small></summary>
    <p className="agent-trace-note">{zh ? `已读取 ${memoryMessages} 条会话记忆 · 以下为决策摘要与工具记录` : `${memoryMessages} memory messages · Decision summaries and tool records`}</p>
    {summarizedMessages > 0 && <p className="agent-trace-note">{zh ? `${summarizedMessages} 条历史已归纳为摘要，近期 ${memoryMessages - summarizedMessages} 条保留原文` : `${summarizedMessages} messages summarized, ${memoryMessages - summarizedMessages} recent messages retained`}</p>}
    <ol>{steps.map((step) => <li key={step.id} data-step-id={step.id} data-phase={step.phase} data-status={step.status} aria-busy={step.status === 'running'}>
      <div><b>{phases[step.phase]}</b>{step.agentId && <code>{step.agentId}</code>}<small>{step.status === 'running' ? (step.stage === 'preparing' ? (zh ? '生成参数中' : 'Preparing arguments') : (zh ? '执行中' : 'Running')) : step.status === 'failed' ? (zh ? '失败' : 'Failed') : step.status === 'cancelled' ? (zh ? '已停止' : 'Stopped') : '✓'}</small></div>
      <pre>{step.output}</pre>
    </li>)}</ol>
  </details>;
}
