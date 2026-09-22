const axios = require('axios');
const { env } = require('../config/env');
const { t } = require('../i18n');
const { createHttpError } = require('../utils/http');

function imageMime(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString())) return 'image/gif';
  if (buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP') return 'image/webp';
  return '';
}
async function uploadDeepseekFile({ buffer, fileName }, { http = axios, apiKey = env.deepseekApiKey, signal } = {}) {
  signal?.throwIfAborted();
  const mime = imageMime(buffer);
  if (!mime) throw createHttpError(400, t('error.deepseekImageFormat'));
  if (buffer.length > Math.min(env.maxUploadFileSizeBytes, 64 * 1024 * 1024)) throw createHttpError(413, t('error.uploadSize', { p0: Math.min(env.maxUploadFileSizeBytes, 64 * 1024 * 1024) }));
  if (!apiKey) throw createHttpError(503, t('error.apiKey', { p0: 'deepseek' }));
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), fileName);
  form.append('purpose', 'user_data');
  try {
    const response = await http.post('https://api.deepseek.com/files', form, { signal, timeout: 120000, maxRedirects: 0, headers: { Authorization: `Bearer ${apiKey}` } });
    const id = response.data?.id;
    if (typeof id !== 'string' || !/^file-[\w-]+$/.test(id)) throw new Error('Invalid file response');
    return id;
  } catch (error) {
    signal?.throwIfAborted();
    throw createHttpError(502, t('error.deepseekFileUpload', { code: String(error.response?.status || error.code || 'INVALID_RESPONSE') }));
  }
}
function resolveDeepseekFiles(fileIds, model) {
  if (!Array.isArray(fileIds) || fileIds.length > env.maxFileUploadCount || fileIds.some(id => typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id))) throw createHttpError(400, t('error.fileIdsArray'));
  if (fileIds.length && !model?.supportsProviderFiles) throw createHttpError(400, t('error.uploadUnsupported', { p0: model?.id || '' }));
  const { getStoredFileMetadata } = require('./fileService');
  return fileIds.map(id => {
    const file = getStoredFileMetadata(id);
    if (file.provider !== 'deepseek' || !file.providerFileId) throw createHttpError(400, t('error.fileUnavailable', { p0: id }));
    return { type: 'file', file_id: file.providerFileId };
  });
}
module.exports = { uploadDeepseekFile, imageMime, resolveDeepseekFiles };
