const { t } = require('../i18n');
const path = require('path');
const { createHttpError } = require('./http');

const TEXT_FILE_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.json',
  '.csv',
  '.tsv',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.sql',
  '.log',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
]);

const IMAGE_FILE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
]);

function sanitizeFileName(fileName) {
  const name = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'file';
  return name.replace(/[/\\?%*:|"<>\x00-\x1F\x7F]/g, '_');
}

function parseBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    return '';
  }

  const boundary = (match[1] || match[2]).trim();
  return boundary.startsWith('--') ? boundary.slice(2) : boundary;
}

function splitBuffer(buffer, separator) {
  const chunks = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    chunks.push(buffer.slice(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  chunks.push(buffer.slice(start));
  return chunks;
}

function parseMultipartUpload(buffer, contentType) {
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    throw createHttpError(400, t('error.multipartBoundary'));
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, boundaryBuffer);

  for (let part of parts) {
    if (!part || part.length === 0) {
      continue;
    }

    if (part.slice(0, 2).equals(Buffer.from('--'))) {
      continue;
    }
    if (part.slice(0, 2).equals(Buffer.from('\r\n'))) {
      part = part.slice(2);
    }
    if (part.slice(-2).equals(Buffer.from('\r\n'))) {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      continue;
    }

    const headerText = part.slice(0, headerEnd).toString('utf8');
    const content = part.slice(headerEnd + 4);
    const dispositionLine = headerText
      .split('\r\n')
      .find((line) => /^content-disposition:/i.test(line));

    if (!dispositionLine) {
      continue;
    }

    const filenameMatch = dispositionLine.match(/filename="([^"]*)"/i);
    if (!filenameMatch || !filenameMatch[1]) {
      continue;
    }

    const mimeTypeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    return {
      fileName: sanitizeFileName(filenameMatch[1]),
      mimeType: mimeTypeMatch ? mimeTypeMatch[1].trim() : 'application/octet-stream',
      buffer: content,
    };
  }

  throw createHttpError(400, t('error.multipartField'));
}

function parseJsonUploadPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw createHttpError(400, t('error.uploadJson'));
  }

  const fileName = sanitizeFileName(payload.fileName || payload.filename || payload.name);
  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType : 'application/octet-stream';
  const encoding = typeof payload.encoding === 'string' ? payload.encoding.toLowerCase() : '';
  const base64Content = payload.contentBase64 || payload.base64;
  let buffer;

  if (typeof base64Content === 'string') {
    buffer = Buffer.from(base64Content, 'base64');
  } else if (typeof payload.content === 'string') {
    buffer = Buffer.from(payload.content, encoding === 'base64' ? 'base64' : 'utf8');
  } else {
    throw createHttpError(400, t('error.uploadJsonContent'));
  }

  return {
    fileName,
    mimeType,
    buffer,
  };
}

function extractUploadFileFromRequest(req) {
  if (Buffer.isBuffer(req.body)) {
    const rawContentType = String(req.headers['content-type'] || '');
    const contentTypeLower = rawContentType.toLowerCase();

    if (contentTypeLower.includes('multipart/form-data')) {
      return parseMultipartUpload(req.body, rawContentType);
    }

    if (contentTypeLower.includes('application/json')) {
      try {
        const payload = JSON.parse(req.body.toString('utf8') || '{}');
        return parseJsonUploadPayload(payload);
      } catch (error) {
        throw createHttpError(400, t('error.uploadJson'));
      }
    }

    const fileNameHeader = req.headers['x-file-name'] || req.headers['x-filename'];
    if (typeof fileNameHeader !== 'string' || !fileNameHeader.trim()) {
      throw createHttpError(400, t('error.uploadFileName'));
    }

    return {
      fileName: sanitizeFileName(fileNameHeader),
      mimeType: rawContentType || 'application/octet-stream',
      buffer: req.body,
    };
  }

  if (req.body && typeof req.body === 'object') {
    return parseJsonUploadPayload(req.body);
  }

  throw createHttpError(400, t('error.uploadMissing'));
}

function isTextLikeFile(fileName, mimeType) {
  if (typeof mimeType === 'string') {
    const normalizedMime = mimeType.toLowerCase();
    if (
      normalizedMime.startsWith('text/')
      || normalizedMime.includes('json')
      || normalizedMime.includes('xml')
      || normalizedMime.includes('yaml')
      || normalizedMime.includes('javascript')
      || normalizedMime.includes('csv')
    ) {
      return true;
    }
  }

  const ext = path.extname(String(fileName || '')).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function isImageLikeFile(fileName, mimeType) {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }

  const ext = path.extname(String(fileName || '')).toLowerCase();
  return IMAGE_FILE_EXTENSIONS.has(ext);
}

module.exports = {
  extractUploadFileFromRequest,
  isImageLikeFile,
  isTextLikeFile,
  sanitizeFileName,
};
