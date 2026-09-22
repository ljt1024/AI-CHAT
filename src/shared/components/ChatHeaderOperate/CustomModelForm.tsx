import { useState } from 'react';
import { useLanguage } from '@/app/providers/LanguageContext';
import { languageHeaders } from '@/app/i18n';
import type { ModelOption } from '@/shared/types/model';

export function CustomModelForm({ models, onClose }: { models: ModelOption[]; onClose: () => void }) {
  const { t } = useLanguage();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [key, setKey] = useState('');
  const [token, setToken] = useState('');
  const [vision, setVision] = useState(false);
  const [tools, setTools] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const choose = (value: string) => {
    const model = models.find(item => item.id === value);
    setId(value); setName(model?.name || ''); setModelId(model?.modelId || ''); setBaseUrl(model?.baseUrl || '');
    setKey(''); setVision(Boolean(model?.supportsVision)); setTools(Boolean(model?.supportsTools)); setError(''); setConfirmDelete(false);
  };
  const save = async (remove = false) => {
    setBusy(true); setError('');
    try {
      const url = new URL(`/api/models/custom${id ? `/${encodeURIComponent(id)}` : ''}`, new URL(import.meta.env.VITE_CHAT_BASE_URL || '/api/chat/completions', location.origin));
      const response = await fetch(url, { method: remove ? 'DELETE' : id ? 'PUT' : 'POST', headers: { ...languageHeaders(), 'Content-Type': 'application/json', 'x-model-config-token': token }, body: remove ? undefined : JSON.stringify({ name, modelId, baseUrl, apiKey: key || undefined, supportsVision: vision, supportsTools: tools }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || t('modelConfig.failed'));
      window.dispatchEvent(new Event('models-changed')); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('modelConfig.failed')); }
    finally { setBusy(false); }
  };
  return <form className="custom-model-form" onSubmit={event => { event.preventDefault(); void save(); }}>
    <p>{t('modelConfig.hint')}</p>
    <fieldset disabled={busy}>
      <label>{t('modelConfig.edit')}<select value={id} onChange={event => choose(event.target.value)}><option value="">{t('modelConfig.new')}</option>{models.filter(model => model.custom).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
      <label>{t('modelConfig.name')}<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>{t('modelConfig.id')}<input required maxLength={160} placeholder="gpt-4o" value={modelId} onChange={event => setModelId(event.target.value)} /></label>
      <label>{t('modelConfig.url')}<input required type="url" placeholder="https://api.example.com/v1" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} /></label>
      <label>{t('modelConfig.key')}<input type="password" required={!id} autoComplete="new-password" placeholder={id ? t('modelConfig.keepKey') : ''} value={key} onChange={event => setKey(event.target.value)} /></label>
      <label>{t('modelConfig.token')}<input type="password" required autoComplete="off" value={token} onChange={event => setToken(event.target.value)} /></label>
      <label className="model-check"><input type="checkbox" checked={vision} onChange={event => setVision(event.target.checked)} />{t('modelConfig.vision')}</label>
      <label className="model-check"><input type="checkbox" checked={tools} onChange={event => setTools(event.target.checked)} />{t('modelConfig.tools')}</label>
      <div className="model-config-actions"><button type="submit">{busy ? t('modelConfig.saving') : t('modelConfig.save')}</button><button type="button" onClick={onClose}>{t('modelConfig.close')}</button>{id && <button type="button" onClick={() => confirmDelete ? void save(true) : setConfirmDelete(true)}>{confirmDelete ? t('modelConfig.confirmDelete') : t('modelConfig.delete')}</button>}</div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
