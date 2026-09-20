const { t } = require('../i18n');
const { env } = require('./env');

const MODEL_CATALOG = [
  {
    id: 'qwen-image-2.0', name: 'Qwen-Image-2.0', provider: 'qwen',
    get description() { return t('model.qwenImage'); },
    supportsImageGeneration: true, supportsStream: false,
    supportsFileUpload: false, supportsVision: false, supportsThinking: false,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    get description() { return t('model.deepseekChat'); },
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    get description() { return t('model.deepseekReasoner'); },
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'qwen',
    get description() { return t('model.qwenTurbo'); },
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: 'qwen3.5-plus',
    name: 'Qwen3.5 Plus',
    provider: 'qwen',
    get description() { return t('model.qwenPlus'); },
    supportsStream: true,
    supportsFileUpload: true,
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'qwen',
    get description() { return t('model.qwenMax'); },
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: false,
  },
];

const MODEL_INDEX = new Map(MODEL_CATALOG.map((item) => [item.id, item]));

const PROVIDER_CONFIG = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: env.deepseekApiKey,
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKey: env.qwenApiKey,
  },
};

function getEnabledModels() {
  return MODEL_CATALOG.map((item) => ({
    supportsImageGeneration: false,
    ...item,
    enabled: Boolean(PROVIDER_CONFIG[item.provider] && PROVIDER_CONFIG[item.provider].apiKey),
  }));
}

module.exports = {
  MODEL_CATALOG,
  MODEL_INDEX,
  PROVIDER_CONFIG,
  getEnabledModels,
};
