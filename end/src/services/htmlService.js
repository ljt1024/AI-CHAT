const { t } = require('../i18n');
const { z } = require('zod');
const { sanitizeFileName } = require('../utils/upload');

const HTML_MIME_TYPE = 'text/html; charset=utf-8';
const htmlSchema = z.object({
  title: z.string().trim().min(1).max(100),
  html: z.string().trim().min(1).max(200000),
});

function normalizeHtml(value) {
  const html = value.trim();
  if (/<html[\s>]/i.test(html) || /<!doctype\s+html/i.test(html)) return html;
  return t('html.document', { p0: html });
}

async function generateHtmlFile(input, { signal } = {}) {
  signal?.throwIfAborted();
  const { title, html } = htmlSchema.parse(input);
  const content = normalizeHtml(html);
  const fileName = `${sanitizeFileName(title).replace(/\.html?$/i, '') || 'page'}.html`;
  return {
    format: 'html',
    fileName,
    mimeType: HTML_MIME_TYPE,
    buffer: Buffer.from(content, 'utf8'),
    title,
    // Keep the normalized document available for the live preview callback.
    // The browser still sanitizes this content before placing it in srcDoc.
    previewContent: content,
  };
}

module.exports = { HTML_MIME_TYPE, generateHtmlFile, htmlSchema };
