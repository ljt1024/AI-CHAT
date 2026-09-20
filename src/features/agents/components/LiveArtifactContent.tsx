import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/app/providers/LanguageContext';
import type { AgentPreview } from '../types';

export function HtmlPreview({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const latest = useRef(content);
  const [display, setDisplay] = useState(content);
  useEffect(() => { latest.current = content; if (!streaming) setDisplay(content); }, [content, streaming]);
  useEffect(() => {
    if (!streaming) return;
    const timer = window.setInterval(() => setDisplay(latest.current), 250);
    return () => window.clearInterval(timer);
  }, [streaming]);
  const { language } = useLanguage();
  const source = useMemo(() => {
    // A fresh opaque-origin, script-free document. CSS remains usable; remote resources are blocked.
    const clean = DOMPurify.sanitize(display, {
      WHOLE_DOCUMENT: true, ADD_TAGS: ['style'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'form'],
      FORBID_ATTR: ['href', 'action', 'formaction', 'target', 'srcset'],
    });
    // Preserve the generated root classes/styles; nesting full documents loses
    // those attributes and breaks layouts that depend on them.
    const parsed = new DOMParser().parseFromString(clean, 'text/html');
    const charset = parsed.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    const policy = parsed.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
    const viewport = parsed.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width,initial-scale=1';
    const defaults = parsed.createElement('style');
    defaults.textContent = 'body{margin:20px;font-family:system-ui,sans-serif;overflow-wrap:anywhere}img,svg{max-width:100%}';
    parsed.head.prepend(charset, policy, viewport, defaults);
    // A generated full-screen page can hide its overflow in a narrow preview.
    // Let the iframe own scrolling, while retaining the page's internal layout.
    for (const root of [parsed.documentElement, parsed.body]) {
      root.style.setProperty('overflow', 'auto', 'important');
      root.style.setProperty('height', 'auto', 'important');
      root.style.setProperty('max-height', 'none', 'important');
    }
    return `<!doctype html>${parsed.documentElement.outerHTML}`;
  }, [display]);
  return <iframe className="artifact-html-frame" title={language === 'zh' ? 'HTML 实时预览' : 'Live HTML preview'} sandbox="" referrerPolicy="no-referrer" srcDoc={source} />;
}

const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';

export function SheetPreview({ sheets = [] }: Pick<AgentPreview, 'sheets'>) {
  const { language } = useLanguage();
  const zh = language === 'zh';
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  const sheet = sheets[Math.min(selected, Math.max(0, sheets.length - 1))];
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
  const columns = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 100) - 1));
  return <div className="artifact-sheet">
    <div className="artifact-sheet-tabs">{sheets.map((item, i) => <button type="button" key={i} aria-pressed={i === selected} onClick={() => { setSelected(i); setPage(0); }}>{text(item?.name) || `${zh ? '工作表' : 'Sheet'} ${i + 1}`}</button>)}</div>
    <div className="artifact-sheet-scroll"><table><thead><tr>{columns.map((column, i) => <th key={i}>{text(column)}</th>)}</tr></thead><tbody>{rows.slice(currentPage * 100, (currentPage + 1) * 100).map((row, i) => <tr key={i}>{(Array.isArray(row) ? row : []).map((cell, j) => <td key={j}>{text(cell)}</td>)}</tr>)}</tbody></table></div>
    <div className="artifact-sheet-pages"><button disabled={currentPage === 0} type="button" onClick={() => setPage(currentPage - 1)}>{zh ? '上一页' : 'Previous'}</button><span>{rows.length} {zh ? '行' : 'rows'} · {currentPage + 1} / {Math.max(1, Math.ceil(rows.length / 100))}</span><button disabled={(currentPage + 1) * 100 >= rows.length} type="button" onClick={() => setPage(currentPage + 1)}>{zh ? '下一页' : 'Next'}</button></div>
  </div>;
}

export function DraftContent({ draft }: { draft: AgentPreview }) {
  if (draft.format === 'html') return <HtmlPreview content={draft.content || ''} streaming={draft.status === 'generating'} />;
  if (draft.format === 'xlsx') return <SheetPreview sheets={draft.sheets} />;
  if (draft.format === 'pptx') return <div className="artifact-draft-slides">{draft.slides?.map((slide, i) => <section className="artifact-draft-slide" key={i}><small>{String(i + 1).padStart(2, '0')}</small><h2>{text(slide?.title)}</h2><ul>{(Array.isArray(slide?.body) ? slide.body : []).map((line, j) => <li key={j}>{text(line)}</li>)}</ul></section>)}</div>;
  return <article className="artifact-draft-document"><h1>{draft.title}</h1><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{draft.content || ''}</ReactMarkdown></article>;
}
