const { t } = require('../i18n');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { messageText } = require('./tools');
const { createHttpError } = require('../utils/http');

const DEFAULT_MEMORY_OPTIONS = {
  contextChars: 24000,
  recentMessages: 8,
  batchChars: 12000,
  summaryChars: 6000,
};

// Split large historical messages as well as conversations. Never silently drop text.
function* historyBatches(messages, batchChars) {
  let batch = '';
  for (const message of messages) {
    const text = `[${message._getType()}]\n${messageText(message)}\n`;
    for (let offset = 0; offset < text.length;) {
      const end = Math.min(text.length, offset + batchChars - batch.length);
      batch += text.slice(offset, end);
      offset = end;
      if (batch.length === batchChars) { yield batch; batch = ''; }
    }
  }
  if (batch) yield batch;
}

async function prepareContext({ history, summary = '', summarizedMessages = 0, model, signal, onProgress = () => {}, options = {} }) {
  const limits = { ...DEFAULT_MEMORY_OPTIONS, ...options };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid memory option: ${key}`);
  }
  if (limits.recentMessages < 2 || limits.recentMessages % 2) throw new Error('recentMessages must be an even number >= 2');
  const pending = history.slice(summarizedMessages);
  const size = summary.length + pending.reduce((sum, message) => sum + messageText(message).length, 0);
  // Keep complete recent turns so retries can replace the latest turn independently.
  const end = Math.max(summarizedMessages, history.length - limits.recentMessages);
  if (size > limits.contextChars && end > summarizedMessages) {
    onProgress({ status: 'running', count: end });
    for (const batch of historyBatches(history.slice(summarizedMessages, end), limits.batchChars)) {
      signal?.throwIfAborted();
      const prompt = [
        new SystemMessage(t('memory.prompt', { p0: limits.summaryChars })),
        new HumanMessage(JSON.stringify({ previousSummary: summary, historicalMessages: batch })),
      ];
      let result;
      for await (const chunk of await model.stream(prompt, { signal })) {
        signal?.throwIfAborted();
        result = result ? result.concat(chunk) : chunk;
      }
      const next = result ? messageText(result).trim() : '';
      if (!next || next.length > limits.summaryChars || result.response_metadata?.finish_reason === 'length') {
        throw createHttpError(502, t('memory.incomplete'));
      }
      summary = next;
    }
    summarizedMessages = end;
    onProgress({ status: 'completed', count: end });
  }
  const recent = history.slice(summarizedMessages);
  return {
    summary, summarizedMessages,
    messages: [...(summary ? [new HumanMessage(t('memory.background', { p0: summary }))] : []), ...recent],
  };
}

module.exports = { prepareContext, DEFAULT_MEMORY_OPTIONS };
