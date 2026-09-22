import i18n from '@/app/i18n';
import { useState } from 'react';
import { useLanguage } from '@/app/providers/LanguageContext';
import type { AgentStep } from '../types';
import './AgentTrace.css';
import { ToolStepDetail } from './ToolStepDetail';

export function AgentTrace({ steps, status, memoryMessages = 0, summarizedMessages = 0 }: {
  steps: AgentStep[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  memoryMessages?: number;
  summarizedMessages?: number;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);
  const phases = { thought: t('agent.phase.thought'), action: t('agent.phase.action'), observation: t('agent.phase.observation') };
  const statuses = { running: t('agent.status.running'), completed: t('agent.status.completed'), failed: t('agent.status.failed'), cancelled: t('agent.status.cancelled') };
  return <details className={`agent-trace agent-trace--${status}`} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span className="agent-status-dot" /><strong>{t('agent.label')}</strong><span role="status">{statuses[status]}</span><small>{t('agent.steps', { count: steps.length })}</small></summary>
    <p className="agent-trace-note">{t('agent.memory', { count: memoryMessages })}</p>
    {summarizedMessages > 0 && <p className="agent-trace-note">{t('agent.summary', { count: summarizedMessages, recent: memoryMessages - summarizedMessages })}</p>}
    <ol>{steps.map((step) => <li key={step.id} data-step-id={step.id} data-phase={step.phase} data-status={step.status} aria-busy={step.status === 'running'}>
      <div><b>{phases[step.phase]}</b>{step.agentId && <code>{step.agentId}</code>}<small>{step.status === 'running' ? (step.stage === 'preparing' ? t('agent.preparing') : t('agent.running')) : step.status === 'failed' ? t('agent.failed') : step.status === 'cancelled' ? t('agent.cancelled') : '✓'}</small></div>
      {step.phase !== 'thought' && step.agentId ? <ToolStepDetail step={step} action={steps.find(item => item.phase === 'action' && Boolean(step.toolCallId) && item.toolCallId === step.toolCallId)} /> : <pre>{step.outputTranslation && i18n.exists(step.outputTranslation.key) ? String(i18n.t(step.outputTranslation.key, step.outputTranslation.params)) : step.output}</pre>}
    </li>)}</ol>
  </details>;
}
