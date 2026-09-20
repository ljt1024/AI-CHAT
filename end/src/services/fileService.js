const express = require('express');
const AliOSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { env } = require('../config/env');
const { createHttpError } = require('../utils/http');
const {
  extractUploadFileFromRequest,
  isImageLikeFile,
  isTextLikeFile,
  sanitizeFileName,
} = require('../utils/upload');

fs.mkdirSync(env.paths.localUploadDir, { recursive: true });

let ossClient = null;
let uploadedFileIndex = loadUploadedFileIndex();

function loadUploadedFileIndex() {
  try {
    if (fs.existsSync(env.paths.localFileIndexPath)) {
      const raw = fs.readFileSync(env.paths.localFileIndexPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    return {};
  }

  return {};
}

function saveUploadedFileIndex() {
  fs.writeFileSync(
    env.paths.localFileIndexPath,
    JSON.stringify(uploadedFileIndex, null, 2),
    'utf8',
  );
}

function validateFileBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw createHttpError(400, '上传文件内容无效');
  }
  if (buffer.length === 0) {
    throw createHttpError(400, '上传文件为空');
  }
  if (buffer.length > env.maxUploadFileSizeBytes) {
    throw createHttpError(400, `文件大小不能超过 ${env.maxUploadFileSizeBytes} 字节`);
  }
}

function buildOssObjectKey(storageName) {
  return [env.oss.prefix, storageName].filter(Boolean).join('/');
}

function resolveFileStorageMode(metadata) {
  if (metadata?.storageProvider === 'local') {
    return 'local';
  }
  if (metadata?.storageProvider === 'oss' || metadata?.objectKey) {
    return 'oss';
  }
  return 'local';
}

function getOssClient() {
  if (ossClient) {
    return ossClient;
  }

  const missingConfig = [];
  if (!env.oss.region) {
    missingConfig.push('OSS_REGION');
  }
  if (!env.oss.bucket) {
    missingConfig.push('OSS_BUCKET');
  }
  if (!env.oss.accessKeyId) {
    missingConfig.push('OSS_ACCESS_KEY_ID');
  }
  if (!env.oss.accessKeySecret) {
    missingConfig.push('OSS_ACCESS_KEY_SECRET');
  }

  if (missingConfig.length > 0) {
    throw createHttpError(500, `OSS 配置缺失: ${missingConfig.join(', ')}`);
  }

  const clientOptions = {
    region: env.oss.region,
    bucket: env.oss.bucket,
    accessKeyId: env.oss.accessKeyId,
    accessKeySecret: env.oss.accessKeySecret,
    secure: env.oss.secure,
  };

  if (env.oss.stsToken) {
    clientOptions.stsToken = env.oss.stsToken;
  }
  if (env.oss.endpoint) {
    clientOptions.endpoint = env.oss.endpoint;
  }

  ossClient = new AliOSS(clientOptions);
  return ossClient;
}

function buildOssErrorMessage(error, fallbackMessage) {
  if (error?.code === 'ENOTFOUND') {
    return 'OSS 域名解析失败，请检查 OSS_REGION 或 OSS_ENDPOINT 配置';
  }
  if (error?.status === 403 || error?.code === 'AccessDenied') {
    return 'OSS 认证失败，请检查 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET 和 Bucket 权限';
  }
  return error?.message || fallbackMessage;
}

async function uploadBufferToOss(objectKey, buffer, mimeType) {
  try {
    await getOssClient().put(objectKey, buffer, {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
      },
    });
  } catch (error) {
    throw createHttpError(502, buildOssErrorMessage(error, '文件上传到 OSS 失败'));
  }
}

function getStoredFileMetadata(fileId) {
  const normalizedFileId = typeof fileId === 'string' ? fileId.trim() : '';
  if (!normalizedFileId) {
    throw createHttpError(400, 'fileId 必须为非空字符串');
  }

  const metadata = uploadedFileIndex[normalizedFileId];
  if (!metadata) {
    throw createHttpError(400, `fileId 不存在: ${normalizedFileId}`);
  }

  return {
    ...metadata,
    fileId: normalizedFileId,
  };
}

function getStoredFileUrl(metadata) {
  if (resolveFileStorageMode(metadata) !== 'oss') {
    throw createHttpError(400, `fileId 对应图片未存储在 OSS: ${metadata.fileId}`);
  }

  const objectKey = metadata.objectKey || buildOssObjectKey(metadata.storageName);

  try {
    return getOssClient().signatureUrl(objectKey, {
      expires: env.ossSignedUrlExpiresSeconds,
    });
  } catch (error) {
    throw createHttpError(502, buildOssErrorMessage(error, '生成 OSS 文件地址失败'));
  }
}

async function readStoredFileBuffer(metadata) {
  if (resolveFileStorageMode(metadata) === 'oss') {
    const objectKey = metadata.objectKey || buildOssObjectKey(metadata.storageName);

    try {
      const result = await getOssClient().get(objectKey);
      if (Buffer.isBuffer(result.content)) {
        return result.content;
      }
      if (result.content instanceof Uint8Array) {
        return Buffer.from(result.content);
      }
      if (typeof result.content === 'string') {
        return Buffer.from(result.content);
      }
      throw createHttpError(500, `fileId 对应文件内容读取失败: ${metadata.fileId}`);
    } catch (error) {
      if (error.code === 'NoSuchKey' || error.status === 404) {
        throw createHttpError(400, `fileId 对应文件不存在: ${metadata.fileId}`);
      }
      throw error;
    }
  }

  const storagePath = path.join(env.paths.localUploadDir, metadata.storageName);
  if (!fs.existsSync(storagePath)) {
    throw createHttpError(400, `fileId 对应文件不存在: ${metadata.fileId}`);
  }

  return fs.readFileSync(storagePath);
}

async function removeStoredFile(metadata) {
  if (resolveFileStorageMode(metadata) === 'oss') {
    const objectKey = metadata.objectKey || buildOssObjectKey(metadata.storageName);

    try {
      await getOssClient().delete(objectKey);
    } catch (error) {
      if (error.code === 'NoSuchKey' || error.status === 404) {
        return;
      }
      throw error;
    }
    return;
  }

  const storagePath = path.join(env.paths.localUploadDir, metadata.storageName);
  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath);
  }
}

async function saveUploadedFile({ fileName, mimeType, buffer }) {
  validateFileBuffer(buffer);

  const safeName = sanitizeFileName(fileName);
  const fileId = crypto.randomUUID();
  const ext = path.extname(safeName);
  const storageName = `${fileId}${ext}`;
  const objectKey = buildOssObjectKey(storageName);
  const now = new Date().toISOString();

  await uploadBufferToOss(objectKey, buffer, mimeType);

  const metadata = {
    fileId,
    fileName: safeName,
    mimeType: mimeType || 'application/octet-stream',
    size: buffer.length,
    storageName,
    objectKey,
    storageProvider: 'oss',
    createdAt: now,
  };

  uploadedFileIndex[fileId] = metadata;
  saveUploadedFileIndex();
  return metadata;
}

function saveLocalFile({ fileName, mimeType, buffer }) {
  validateFileBuffer(buffer);

  const safeName = sanitizeFileName(fileName);
  const fileId = crypto.randomUUID();
  const ext = path.extname(safeName);
  const storageName = `${fileId}${ext}`;
  const storagePath = path.join(env.paths.localUploadDir, storageName);
  const now = new Date().toISOString();

  fs.writeFileSync(storagePath, buffer);

  const metadata = {
    fileId,
    fileName: safeName,
    mimeType: mimeType || 'application/octet-stream',
    size: buffer.length,
    storageName,
    storageProvider: 'local',
    createdAt: now,
  };

  uploadedFileIndex[fileId] = metadata;
  saveUploadedFileIndex();
  return metadata;
}

async function deleteUploadedFilesByIds(fileIds) {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return;
  }

  let hasIndexChanged = false;
  for (const rawId of fileIds) {
    const fileId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!fileId) {
      continue;
    }

    const metadata = uploadedFileIndex[fileId];
    if (!metadata) {
      continue;
    }

    try {
      await removeStoredFile(metadata);
    } catch (error) {
      continue;
    }

    delete uploadedFileIndex[fileId];
    hasIndexChanged = true;
  }

  if (hasIndexChanged) {
    saveUploadedFileIndex();
  }
}

async function normalizeFilesFromIds(fileIds) {
  if (!Array.isArray(fileIds)) {
    throw createHttpError(400, 'fileIds 必须为数组');
  }

  return Promise.all(fileIds.map(async (rawId, index) => {
    if (typeof rawId !== 'string' || !rawId.trim()) {
      throw createHttpError(400, `fileIds[${index}] 必须为非空字符串`);
    }

    const metadata = getStoredFileMetadata(rawId);
    const fileId = metadata.fileId;
    const imageLike = isImageLikeFile(metadata.fileName, metadata.mimeType);

    if (imageLike) {
      return {
        name: metadata.fileName,
        type: metadata.mimeType || 'application/octet-stream',
        url: getStoredFileUrl(metadata),
        content: '',
        note: '',
        fileId,
        isImage: true,
      };
    }

    const buffer = await readStoredFileBuffer({
      ...metadata,
      fileId,
    });

    const textLike = isTextLikeFile(metadata.fileName, metadata.mimeType);
    let content = '';
    let note = '';

    if (textLike) {
      const text = buffer.toString('utf8');
      content = text.slice(0, env.maxFileContentLength);
      if (text.length > env.maxFileContentLength) {
        note = `文件内容已截断，原始长度 ${text.length} 字符`;
      }
    } else {
      note = '该文件为二进制文件，当前仅传递文件元信息，未提取正文。';
    }

    return {
      name: metadata.fileName,
      type: metadata.mimeType || 'application/octet-stream',
      url: '',
      content,
      note,
      fileId,
      isImage: false,
    };
  }));
}

const uploadBodyParser = express.raw({
  type: '*/*',
  limit: env.maxUploadFileSizeBytes,
});

function buildFileDownloadPath(fileId) {
  return `/api/files/${encodeURIComponent(fileId)}/download`;
}

function buildAbsoluteUrl(req, pathname) {
  const host = req?.get?.('host');
  if (!host) {
    return pathname;
  }

  return `${req.protocol}://${host}${pathname}`;
}

function buildFileAccessPayload(req, metadata) {
  const fileId = metadata.fileId;

  if (resolveFileStorageMode(metadata) === 'oss') {
    const url = getStoredFileUrl(metadata);
    const urlExpiresAt = new Date(
      Date.now() + (env.ossSignedUrlExpiresSeconds * 1000),
    ).toISOString();

    return {
      fileId,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      storageProvider: 'oss',
      url,
      downloadPath: '',
      urlExpiresAt,
      createdAt: metadata.createdAt,
    };
  }

  const downloadPath = buildFileDownloadPath(fileId);

  return {
    fileId,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
    size: metadata.size,
    storageProvider: 'local',
    url: buildAbsoluteUrl(req, downloadPath),
    downloadPath,
    urlExpiresAt: '',
    createdAt: metadata.createdAt,
  };
}

module.exports = {
  buildFileAccessPayload,
  buildFileDownloadPath,
  deleteUploadedFilesByIds,
  extractUploadFileFromRequest,
  getStoredFileMetadata,
  getStoredFileUrl,
  normalizeFilesFromIds,
  readStoredFileBuffer,
  saveLocalFile,
  saveUploadedFile,
  uploadBodyParser,
};
