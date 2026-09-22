import { useState } from 'react';
import { useLanguage } from '@/app/providers/LanguageContext';
import MarkdownContent from '../MarkDownContent';

export function ReasoningPanel({ content, loading, durationMs, interrupted }: {
  content: string; loading: boolean; durationMs?: number; interrupted?: boolean;
}) {
  const { t, dateLocale } = useLanguage();
  const [open, setOpen] = useState(true);
  const seconds = durationMs === undefined ? null : new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(durationMs / 1000);
  return <details className="reasoning-panel" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span>{loading ? t('reasoning.generating') : interrupted ? t('reasoning.interrupted') : t('reasoning.complete')}</span>{seconds !== null && !loading && <small>{t('reasoning.duration', { seconds })}</small>}</summary>
    <div className="reasoning-panel-content"><MarkdownContent msg={content} /></div>
  </details>;
}
