const { ChatOpenAI } = require('@langchain/openai');
const { MODEL_INDEX, PROVIDER_CONFIG } = require('../config/models');
const { createHttpError } = require('../utils/http');

function createChatModel(modelId) {
  const model = MODEL_INDEX.get(modelId);
  if (!model) throw createHttpError(400, `不支持的模型: ${modelId}`);
  const provider = PROVIDER_CONFIG[model.provider];
  if (!provider?.apiKey) throw createHttpError(503, `${model.provider} API Key 未配置`);
  return new ChatOpenAI({
    model: model.id,
    apiKey: provider.apiKey,
    configuration: { baseURL: provider.endpoint.replace(/\/chat\/completions\/?$/, '') },
    // Use Chat Completions for both OpenAI-compatible providers.
    useResponsesApi: false,
    modelKwargs: model.provider === 'qwen' && model.supportsThinking ? { enable_thinking: false } : {},
    timeout: 120000,
    maxRetries: 1,
  });
}
module.exports = { createChatModel };
