import { useState } from 'react';
import { useLanguage } from '@/app/providers/LanguageContext';
import { downloadAgentArtifact } from '../api';
import type { AgentArtifact } from '../types';
import './AgentArtifacts.css';

function ArtifactCard({ artifact, onPreview }: { artifact: AgentArtifact; onPreview?: (artifact: AgentArtifact) => void }) {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadAgentArtifact(artifact.fileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('artifact.downloadError'));
    } finally { setDownloading(false); }
  };
  const size = artifact.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(artifact.size / 1024))} KB` : `${(artifact.size / 1024 / 1024).toFixed(1)} MB`;
  return <li className="agent-artifact">
    <span className="agent-artifact-format">{artifact.format === 'xlsx' ? 'Excel' : artifact.format === 'pptx' ? 'PPT' : artifact.format.toUpperCase()}</span>
    <div className="agent-artifact-info"><strong>{artifact.fileName}</strong><small>{size} · {t('artifact.ready')}</small></div>
    {onPreview && (artifact.format === 'png' || artifact.format === 'pdf' || artifact.format === 'pptx' || artifact.format === 'html' || artifact.format === 'xlsx') && <button type="button" onClick={() => onPreview(artifact)} aria-label={`${t('share.previewAlt')} ${artifact.fileName}`}>{t('share.previewAlt')}</button>}
    <button type="button" onClick={download} disabled={downloading} aria-label={`${t('artifact.downloadLabel')} ${artifact.fileName}`}>
      {downloading ? t('artifact.downloading') : t('artifact.download')}
    </button>
    {error && <p className="agent-artifact-error" role="alert">{error}</p>}
  </li>;
}

export function AgentArtifacts({ artifacts, onPreview }: { artifacts: AgentArtifact[]; onPreview?: (artifact: AgentArtifact) => void }) {
  const { t } = useLanguage();
  if (!artifacts.length) return null;
  return <ul className="agent-artifacts" aria-label={t('artifact.files')}>
    {artifacts.map((artifact) => <ArtifactCard key={artifact.fileId} artifact={artifact} onPreview={onPreview} />)}
  </ul>;
}
