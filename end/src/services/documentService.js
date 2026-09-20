const { t } = require('../i18n');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createHttpError } = require('../utils/http');
const { sanitizeFileName } = require('../utils/upload');
const { generatePdfBuffer } = require('./pdfService');

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME_TYPE = 'application/pdf';

function normalizeDocumentFormat(rawFormat) {
  const format = typeof rawFormat === 'string' ? rawFormat.trim().toLowerCase() : '';

  if (format === 'word') {
    return 'docx';
  }
  if (format === 'docx' || format === 'pdf') {
    return format;
  }

  throw createHttpError(400, t('error.documentFormat'));
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeParagraphs(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof input !== 'string') {
    return [];
  }

  const normalized = input.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFileName({ fileName, title, format }) {
  const fallbackName = title || `document-${Date.now()}`;
  const baseName = sanitizeFileName(fileName || fallbackName);
  const expectedExt = format === 'pdf' ? '.pdf' : '.docx';
  const currentExt = path.extname(baseName).toLowerCase();

  if (currentExt === expectedExt) {
    return baseName;
  }

  if (currentExt) {
    return `${baseName.slice(0, -currentExt.length)}${expectedExt}`;
  }

  return `${baseName}${expectedExt}`;
}

function normalizeDocumentRequest(body, contentFallback = '') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, t('error.documentBody'));
  }

  const format = normalizeDocumentFormat(body.format);
  const title = trimString(body.title);
  const directContent = typeof body.content === 'string'
    ? body.content
    : (typeof body.text === 'string' ? body.text : '');
  const paragraphs = normalizeParagraphs(body.paragraphs);
  const lines = normalizeParagraphs(Array.isArray(body.lines) ? body.lines.join('\n\n') : '');
  const fallbackParagraphs = normalizeParagraphs(contentFallback);
  const resolvedParagraphs = paragraphs.length > 0
    ? paragraphs
    : (lines.length > 0 ? lines : normalizeParagraphs(directContent));
  const finalParagraphs = resolvedParagraphs.length > 0 ? resolvedParagraphs : fallbackParagraphs;

  if (finalParagraphs.length === 0) {
    throw createHttpError(400, t('error.documentContent'));
  }

  return {
    format,
    title,
    fileName: buildFileName({
      fileName: trimString(body.fileName),
      title,
      format,
    }),
    mimeType: format === 'pdf' ? PDF_MIME_TYPE : DOCX_MIME_TYPE,
    paragraphs: finalParagraphs,
  };
}

function encodeRtfText(text) {
  const input = String(text || '').replace(/\r\n/g, '\n');
  let result = '';

  for (let index = 0; index < input.length; index += 1) {
    const codeUnit = input.charCodeAt(index);
    const char = input[index];

    if (char === '\\' || char === '{' || char === '}') {
      result += `\\${char}`;
      continue;
    }

    if (char === '\n') {
      result += '\\line ';
      continue;
    }

    if (codeUnit >= 32 && codeUnit <= 126) {
      result += char;
      continue;
    }

    const signedCode = codeUnit > 32767 ? codeUnit - 65536 : codeUnit;
    result += `\\u${signedCode}?`;
  }

  return result;
}

function buildRtf({ title, paragraphs }) {
  const titleBlock = title
    ? `\\fs40\\b ${encodeRtfText(title)}\\b0\\fs24\\par\\par\n`
    : '';
  const bodyBlock = paragraphs
    .map((paragraph) => `${encodeRtfText(paragraph)}\\par\\par`)
    .join('\n');

  return [
    '{\\rtf1\\ansi\\ansicpg65001\\deff0',
    '{\\fonttbl{\\f0 Helvetica;}}',
    '\\paperw12240\\paperh15840\\margl1440\\margr1440\\margt1440\\margb1440',
    '\\f0\\fs24',
    titleBlock + bodyBlock,
    '}',
    '',
  ].join('\n');
}

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-server-doc-'));
}

function cleanupTempDir(tempDir) {
  fs.rmSync(tempDir, {
    recursive: true,
    force: true,
  });
}

function runCommand(command, args, errorMessage) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
    });

    child.on('error', (error) => {
      reject(createHttpError(500, `${errorMessage}: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdoutChunks),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
        });
        return;
      }

      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      reject(createHttpError(500, `${errorMessage}${stderr ? `: ${stderr}` : ''}`));
    });
  });
}

async function generateDocxBuffer(documentData) {
  if (!fs.existsSync('/usr/bin/textutil')) {
    throw createHttpError(500, t('error.textutil'));
  }

  const tempDir = createTempDir();
  const inputPath = path.join(tempDir, 'document.rtf');
  const outputPath = path.join(tempDir, 'document.docx');

  try {
    fs.writeFileSync(inputPath, buildRtf(documentData), 'utf8');
    await runCommand('/usr/bin/textutil', ['-convert', 'docx', inputPath, '-output', outputPath], t('error.word'));
    return fs.readFileSync(outputPath);
  } finally {
    cleanupTempDir(tempDir);
  }
}

async function generateDocumentFile(body, contentFallback = '', options = {}) {
  const documentData = normalizeDocumentRequest(body, contentFallback);
  const buffer = documentData.format === 'pdf'
    ? await generatePdfBuffer(documentData, options)
    : await generateDocxBuffer(documentData);

  return {
    format: documentData.format,
    fileName: documentData.fileName,
    mimeType: documentData.mimeType,
    buffer,
    title: documentData.title,
  };
}

function extractTextFromContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

function extractAssistantText(chatResponse) {
  const choices = Array.isArray(chatResponse?.choices) ? chatResponse.choices : [];

  for (const choice of choices) {
    const messageText = extractTextFromContent(choice?.message?.content);
    if (messageText) {
      return messageText;
    }

    const text = extractTextFromContent(choice?.text);
    if (text) {
      return text;
    }
  }

  return '';
}

module.exports = {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  extractAssistantText,
  generateDocumentFile,
};
