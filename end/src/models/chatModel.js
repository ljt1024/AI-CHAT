const { t } = require('../i18n');
const { ChatOpenAI } = require('@langchain/openai');
const { MODEL_INDEX, getProvider } = require('../config/models');
const { createHttpError } = require('../utils/http');

function createChatModel(modelId) {
  const model = MODEL_INDEX.get(modelId);
  if (!model) throw createHttpError(400, t('error.modelUnsupported', { p0: modelId }));
  if (model.supportsImageGeneration) throw createHttpError(400, t('error.imageNotChat'));
  const provider = getProvider(model);
  if (!provider?.apiKey) throw createHttpError(503, t('error.apiKey', { p0: model.provider }));
  return new ChatOpenAI({
    model: model.modelId || model.id,
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
