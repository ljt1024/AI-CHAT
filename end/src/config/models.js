const { env } = require('./env');

const MODEL_CATALOG = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    description: 'DeepSeek 通用对话模型',
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    description: 'DeepSeek 推理模型',
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'qwen',
    description: '千问 Turbo',
    supportsStream: true,
    supportsFileUpload: false,
    supportsVision: false,
    supportsThinking: true,
  },
  {
    id: 'qwen3.5-plus',
    name: 'Qwen3.5 Plus',
    provider: 'qwen',
    description: '千问 Plus',
    supportsStream: true,
    supportsFileUpload: true,
    supportsVision: true,
    supportsThinking: true,
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'qwen',
    description: '千问 Max',
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
