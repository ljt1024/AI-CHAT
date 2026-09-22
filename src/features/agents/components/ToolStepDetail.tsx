import { useLanguage } from '@/app/providers/LanguageContext';
import type { AgentStep } from '../types';

function objectFrom(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

/** Summaries describe recorded tool events, never inferred model reasoning. */
export function ToolStepDetail({ step, action }: { step: AgentStep; action?: AgentStep }) {
  const { t } = useLanguage();
  const tool = step.agentId || action?.agentId || '';
  const names: Record<string, string> = {
    calculate: t('trace.calculate'), current_time: t('trace.time'), get_weather: t('trace.weather'),
    generate_image: t('trace.image'), export_html: t('trace.html'), export_pdf: t('trace.pdf'),
    export_excel: t('trace.excel'), export_pptx: t('trace.ppt'),
    delegate_planner: t('trace.planner'), delegate_researcher: t('trace.researcher'), delegate_writer: t('trace.writer'),
  };
  const name = names[tool] || tool;
  const args = objectFrom(step.phase === 'action' ? step.output : action?.output || '');
  const result = step.phase === 'observation' ? objectFrom(step.output) : null;
  const isAction = step.phase === 'action';
  const headline = step.status === 'failed' ? t('trace.failed', { name })
    : step.status === 'cancelled' ? t('trace.cancelled', { name })
    : isAction ? step.status === 'running'
      ? step.stage === 'preparing' ? t('trace.preparing', { name }) : t('trace.calling', { name })
      : t('trace.called', { name })
    : step.status === 'running' ? t('trace.receiving', { name }) : t('trace.received', { name });
  const details: string[] = [];
  if (args) {
    if (typeof args.city === 'string') details.push(t('trace.city', { city: args.city, kind: args.forecast ? t('trace.forecast') : t('trace.current') }));
    if (typeof args.title === 'string') details.push(t('trace.title', { title: args.title }));
    if (typeof args.operation === 'string' && Array.isArray(args.values)) details.push(t('trace.expression', { value: `${args.operation} (${args.values.join(', ')})` }));
    if (typeof args.task === 'string') details.push(t('trace.task', { task: args.task.slice(0, 240) }));
    if (Array.isArray(args.slides)) details.push(t('trace.slides', { count: args.slides.length }));
    if (Array.isArray(args.sheets)) details.push(t('trace.sheets', { count: args.sheets.length }));
  }
  if (step.status === 'completed' && result) {
    if (typeof result.fileId === 'string' && typeof result.fileName === 'string' && typeof result.downloadPath === 'string') {
      details.push(t('trace.written', { file: result.fileName }));
      if (typeof result.size === 'number') details.push(t('trace.bytes', { count: result.size }));
      if (typeof result.previewFileId === 'string') details.push(t('trace.previewSaved'));
    }
    if (typeof result.result === 'number') details.push(t('trace.result', { value: result.result }));
    if (typeof result.source === 'string') details.push(t('trace.source', { source: result.source }));
    if (typeof result.reportTime === 'string' && result.reportTime) details.push(t('trace.reportTime', { time: result.reportTime }));
  }
  return <section className="agent-tool-detail">
    <p className="agent-tool-headline">{headline}</p>
    {details.length > 0 && <ul>{details.map((text, index) => <li key={index}>{text}</li>)}</ul>}
    <details className="agent-tool-raw" open={step.status === 'failed' || step.status === 'running'}>
      <summary>{isAction ? t('trace.parameters') : t('trace.rawResult')}</summary>
      <pre>{step.output || t('trace.waiting')}</pre>
    </details>
  </section>;
}
