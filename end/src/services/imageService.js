const axios = require('axios');
const { z } = require('zod');
const { env } = require('../config/env');
const { t } = require('../i18n');
const { createHttpError } = require('../utils/http');
const { sanitizeFileName } = require('../utils/upload');

const imageSchema = z.object({
  title: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(4000),
  size: z.enum(['1024*1024', '1536*1024', '1024*1536', '2048*2048']).default('1024*1024'),
  negativePrompt: z.string().trim().max(1000).optional(),
});

// Transport injection keeps provider-contract tests offline. No retry: generation is billable.
async function generateImageFile(input, { signal, http = axios, apiKey = env.qwenApiKey } = {}) {
  const { title, prompt, size, negativePrompt } = imageSchema.parse(input);
  signal?.throwIfAborted();
  if (!apiKey) throw createHttpError(503, t('error.imageKey'));
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(180000)]);
  try {
    const { data } = await http.post(env.qwenImageEndpoint, {
      model: 'qwen-image-2.0',
      input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
      parameters: { size, n: 1, watermark: false, ...(negativePrompt ? { negative_prompt: negativePrompt } : {}) },
    }, { signal: requestSignal, timeout: 180000, headers: { Authorization: `Bearer ${apiKey}` } });
    if (data.code) throw createHttpError(502, t('error.imageProvider', { code: data.code }));
    const imageUrl = data.output?.choices?.[0]?.message?.content?.find(part => part.image)?.image;
    const url = new URL(imageUrl);
    // Only fetch Alibaba's generated-image storage; never forward credentials to storage.
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.aliyuncs.com') || url.username || url.password || (url.port && url.port !== '443')) {
      throw createHttpError(502, t('error.imageResult'));
    }
    const response = await http.get(url.href, {
      signal: requestSignal, timeout: 60000, responseType: 'arraybuffer', maxRedirects: 0,
      maxContentLength: env.maxUploadFileSizeBytes,
    });
    const buffer = Buffer.from(response.data);
    if (buffer.length > env.maxUploadFileSizeBytes || !buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
      throw createHttpError(502, t('error.imageResult'));
    }
    signal?.throwIfAborted();
    return { format: 'png', title, fileName: `${sanitizeFileName(title).replace(/\.png$/i, '')}.png`, mimeType: 'image/png', buffer };
  } catch (error) {
    signal?.throwIfAborted();
    if (requestSignal.aborted) throw createHttpError(504, t('error.imageTimeout'));
    if (error.status && !error.isAxiosError) throw error;
    const code = error.response?.data?.code;
    throw createHttpError(502, code ? t('error.imageProvider', { code: String(code).slice(0, 100) }) : t('error.imageResult'));
  }
}
module.exports = { imageSchema, generateImageFile };
