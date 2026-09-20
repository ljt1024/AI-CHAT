const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});

function readEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function readPositiveNumberEnv(names, fallback) {
  const rawValue = readEnvValue(...names);
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function readBooleanEnv(names, fallback) {
  const rawValue = readEnvValue(...names);
  if (!rawValue) {
    return fallback;
  }

  if (['true', '1', 'yes', 'on'].includes(rawValue.toLowerCase())) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(rawValue.toLowerCase())) {
    return false;
  }

  return fallback;
}

function normalizeOssPrefix(prefix) {
  return String(prefix || '').replace(/^\/+|\/+$/g, '');
}

function normalizeOssRegion(region) {
  const value = String(region || '').trim();
  if (!value) {
    return '';
  }
  if (value.startsWith('oss-') || value.startsWith('vpc100-oss-')) {
    return value;
  }
  return `oss-${value}`;
}

const projectRoot = path.resolve(__dirname, '../..');
const localStorageDir = path.join(projectRoot, 'local_storage');

const env = {
  port: readPositiveNumberEnv(['PORT'], 3001),
  maxUploadFileSizeBytes: readPositiveNumberEnv(['MAX_UPLOAD_FILE_SIZE_BYTES'], 20 * 1024 * 1024),
  maxFileUploadCount: readPositiveNumberEnv(['MAX_FILE_UPLOAD_COUNT'], 10),
  maxFileContentLength: readPositiveNumberEnv(['MAX_FILE_CONTENT_LENGTH'], 12000),
  ossSignedUrlExpiresSeconds: readPositiveNumberEnv(['OSS_SIGNED_URL_EXPIRES_SECONDS'], 1800),
  deepseekApiKey: readEnvValue('DEEPSEEK_API_KEY'),
  qwenApiKey: readEnvValue('DASHSCOPE_API_KEY', 'QWEN_API_KEY'),
  qwenImageEndpoint: readEnvValue('QWEN_IMAGE_ENDPOINT') || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  oss: {
    region: normalizeOssRegion(readEnvValue('OSS_REGION', 'ALI_OSS_REGION')),
    bucket: readEnvValue('OSS_BUCKET', 'ALI_OSS_BUCKET'),
    accessKeyId: readEnvValue('OSS_ACCESS_KEY_ID', 'ALI_OSS_ACCESS_KEY_ID'),
    accessKeySecret: readEnvValue('OSS_ACCESS_KEY_SECRET', 'ALI_OSS_ACCESS_KEY_SECRET'),
    stsToken: readEnvValue('OSS_STS_TOKEN', 'ALI_OSS_STS_TOKEN'),
    endpoint: readEnvValue('OSS_ENDPOINT', 'ALI_OSS_ENDPOINT'),
    secure: readBooleanEnv(['OSS_SECURE', 'ALI_OSS_SECURE'], true),
    prefix: normalizeOssPrefix(readEnvValue('OSS_PREFIX', 'ALI_OSS_PREFIX') || 'uploads'),
  },
  paths: {
    projectRoot,
    localStorageDir,
    localUploadDir: path.join(localStorageDir, 'uploads'),
    localFileIndexPath: path.join(localStorageDir, 'file-index.json'),
  },
};

module.exports = {
  env,
  readEnvValue,
};
