import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DraftContent, HtmlPreview, SheetPreview } from './LiveArtifactContent';
import { downloadAgentArtifact } from '../api';
import type { AgentPreview, AgentArtifact } from '../types';
import { getFileDownloadUrl } from '@/shared/utils/fileDownloads';
import { useLanguage } from '@/app/providers/LanguageContext';
import './ArtifactPreviewPanel.css';

export function ArtifactPreviewPanel({ artifact, artifacts, onSelect, onClose }: {
  artifact: AgentArtifact;
  artifacts: AgentArtifact[];
  onSelect: (artifact: AgentArtifact) => void;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const zh = language === 'zh';
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [fileContent, setFileContent] = useState<{ html?: string; sheets?: AgentPreview['sheets'] } | null>(null);
  const [fileError, setFileError] = useState('');
  const [width, setWidth] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isSlides = artifact.format === 'pptx';
  const draft = artifact.draft;
  const isWebOrSheet = artifact.format === 'html' || artifact.format === 'xlsx';
  const previewId = !draft ? (isSlides ? artifact.previewFileId : artifact.format === 'pdf' ? artifact.fileId : undefined) : undefined;

  useEffect(() => {
    setFileContent(null); setFileError('');
    if (draft || !isWebOrSheet) return;
    const controller = new AbortController();
    const id = artifact.format === 'html' ? artifact.fileId : artifact.previewFileId;
    if (!id) { setFileError(zh ? '旧文件没有保存预览数据，请下载查看。' : 'This older file has no preview data. Please download it.'); return; }
    void downloadAgentArtifact(id, controller.signal).then(blob => blob.text()).then(content => {
      if (controller.signal.aborted) return;
      if (artifact.format === 'html') setFileContent({ html: content });
      else {
        const data = JSON.parse(content);
        if (!Array.isArray(data.sheets)) throw new Error('Invalid spreadsheet preview');
        setFileContent({ sheets: data.sheets });
      }
    }).catch(cause => { if (!controller.signal.aborted) setFileError(String(cause.message || cause)); });
    return () => controller.abort();
  }, [artifact.fileId, artifact.previewFileId, artifact.format, Boolean(draft), isWebOrSheet, retry, zh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (globalThis.document.fullscreenElement) {
        void globalThis.document.exitFullscreen();
        return;
      }
      if (fullscreenFallback) {
        setFullscreenFallback(false);
        return;
      }
      onClose();
    };
    const onFullscreenChange = () => setIsFullscreen(globalThis.document.fullscreenElement === panelRef.current);
    window.addEventListener('keydown', onKey);
    globalThis.document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      globalThis.document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [fullscreenFallback, onClose]);

  const toggleFullscreen = async () => {
    const panel = panelRef.current;
    if (!panel) return;
    if (globalThis.document.fullscreenElement) {
      await globalThis.document.exitFullscreen();
      return;
    }
    if (fullscreenFallback) {
      setFullscreenFallback(false);
      return;
    }
    if (typeof panel.requestFullscreen === 'function') {
      try {
        await panel.requestFullscreen();
        return;
      } catch {
        // Some embedded browsers deny the native API; keep a CSS fallback.
      }
    }
    setFullscreenFallback(true);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    setDocument(null);
    setPage(1);
    setError('');
    setRendering(true);
    if (previewId) {
      void import('pdfjs-dist').then(async pdfjs => {
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        loadingTask = pdfjs.getDocument({ url: getFileDownloadUrl(previewId) });
        const loaded = await loadingTask.promise;
        if (!cancelled) setDocument(loaded);
      }).catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    }
    return () => { cancelled = true; void loadingTask?.destroy(); };
  }, [previewId, retry]);

  useEffect(() => {
    if (!document || !width) return;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setRendering(true);
    setError('');
    void document.getPage(page).then(async pdfPage => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const scale = width * zoom / pdfPage.getViewport({ scale: 1 }).width;
      const viewport = pdfPage.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      task = pdfPage.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (!cancelled) setRendering(false);
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [document, page, width, zoom]);

  return <aside ref={panelRef} className={`artifact-preview${isFullscreen || fullscreenFallback ? ' is-fullscreen' : ''}`} aria-label={zh ? '文件预览' : 'File preview'}>
    <header className="artifact-preview-head">
      <div><span className="artifact-preview-label">{zh ? '文件预览' : 'FILE PREVIEW'} · {artifact.format === 'xlsx' ? 'Excel' : artifact.format.toUpperCase()}</span><strong>{artifact.fileName}</strong></div>
      <div className="artifact-preview-head-actions">
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen || fullscreenFallback ? (zh ? '退出全屏' : 'Exit fullscreen') : (zh ? '全屏打开' : 'Open fullscreen')} title={isFullscreen || fullscreenFallback ? (zh ? '退出全屏' : 'Exit fullscreen') : (zh ? '全屏打开' : 'Open fullscreen')}>
          {isFullscreen || fullscreenFallback ? '↙' : '⛶'}
        </button>
        <button type="button" onClick={onClose} aria-label={zh ? '关闭预览' : 'Close preview'}>×</button>
      </div>
    </header>
    <div className="artifact-preview-toolbar">
      <select aria-label={zh ? '选择预览文件' : 'Select a file'} value={artifact.fileId} onChange={event => {
        const selected = artifacts.find(file => file.fileId === event.target.value);
        if (selected) onSelect(selected);
      }}>{artifacts.map(file => <option key={file.fileId} value={file.fileId}>{file.fileName}</option>)}</select>
      {!draft && <a href={getFileDownloadUrl(artifact.fileId)} download={artifact.fileName}>{zh ? '下载原文件' : 'Download'}</a>}
    </div>
    {draft && <div className={`artifact-preview-status artifact-preview-status--${draft.status}`} role="status">
      <span>{draft.status === 'generating' ? (zh ? '正在生成 · 实时预览' : 'Generating · Live preview') : draft.status === 'saving' ? (zh ? '正在生成文件…' : 'Saving file…') : draft.status === 'cancelled' ? (zh ? '已停止 · 保留草稿' : 'Stopped · Draft retained') : (zh ? '生成失败 · 保留草稿' : 'Failed · Draft retained')}</span>
      <small>{zh ? '草稿尚未保存为文件' : 'Draft has not been saved as a file'}</small>
    </div>}
    <div className={`artifact-preview-body${artifact.format === 'html' ? ' artifact-preview-body--html' : ''}`} ref={hostRef} aria-busy={Boolean(previewId && rendering && !error)}>
      {draft ? <DraftContent draft={draft} /> : isWebOrSheet ? (
        fileError ? <div className="artifact-preview-error" role="alert"><p>{fileError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{zh ? '重新加载' : 'Retry'}</button></div>
        : !fileContent ? <p role="status">{zh ? '正在加载页面…' : 'Loading…'}</p>
        : artifact.format === 'html' ? <HtmlPreview content={fileContent.html || ''} /> : <SheetPreview sheets={fileContent.sheets} />
      ) : !previewId ? <p>{zh ? '此文件没有可用预览，请下载查看。' : 'Preview unavailable. Please download the file.'}</p> : error ?
        <div className="artifact-preview-error" role="alert"><p>{zh ? '预览加载失败，请确认后端服务和文件仍然可用。' : 'Preview failed. Check that the service and file are available.'}</p><small>{error}</small><button onClick={() => setRetry(value => value + 1)} type="button">{zh ? '重新加载' : 'Retry'}</button></div> : <>
          {rendering && <p className="artifact-preview-loading" role="status">{zh ? '正在加载页面…' : 'Loading page…'}</p>}
          <canvas ref={canvasRef} style={{ visibility: rendering ? 'hidden' : 'visible' }} role="img" aria-label={`${artifact.fileName} — ${zh ? '第' : 'Page'} ${page} ${zh ? '页' : ''}`} />
        </>}
    </div>
    {!draft && !isWebOrSheet && <footer className="artifact-preview-footer">
      <div className="artifact-preview-zoom">
        <button type="button" aria-label={zh ? '缩小' : 'Zoom out'} disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.25))}>−</button>
        <button type="button" onClick={() => setZoom(1)} aria-label={zh ? '适应宽度' : 'Fit width'}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label={zh ? '放大' : 'Zoom in'} disabled={zoom >= 2.5} onClick={() => setZoom(value => Math.min(2.5, value + 0.25))}>+</button>
      </div>
      <nav aria-label={zh ? '页面导航' : 'Page navigation'}>
        <button type="button" disabled={!document || page <= 1} onClick={() => setPage(value => value - 1)} aria-label={zh ? '上一页' : 'Previous page'}>‹</button>
        <span aria-live="polite">{document ? `${page} / ${document.numPages}` : '—'}</span>
        <button type="button" disabled={!document || page >= document.numPages} onClick={() => setPage(value => value + 1)} aria-label={zh ? '下一页' : 'Next page'}>›</button>
      </nav>
      <small>{isSlides ? (zh ? '幻灯片预览 · Office 中字体可能略有差异' : 'Slide preview · Fonts may vary in Office') : (zh ? '原始 PDF · 可逐页查看' : 'Original PDF · Browse pages')}</small>
    </footer>}
    {artifact.format === 'html' && <div className="artifact-preview-html-note">{zh ? '隔离预览 · 展示 HTML / CSS，脚本交互请下载后打开' : 'Isolated HTML / CSS preview · Download for script interactions'}</div>}
  </aside>;
}
