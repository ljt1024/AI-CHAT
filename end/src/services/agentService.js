const { resolveDeepseekFiles } = require('./deepseekFileService');
const { MODEL_INDEX } = require('../config/models');
const { runImageGeneration } = require('./imageRunService');
const { t } = require('../i18n');
const { randomUUID } = require('node:crypto');
const { createGraph } = require('../agents/graph');
const { createAgentTools } = require('../agents/tools');
const { createMemoryStore, legacyHistory } = require('../agents/memoryStore');
const { createChatModel } = require('../models/chatModel');
const { getAgent } = require('../agents/registry');
const { createHttpError } = require('../utils/http');

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createHttpError(400, t('error.body'));
  if (typeof body.input !== 'string' || !body.input.trim()) throw createHttpError(400, t('error.inputRequired'));
  if (body.input.length > 100000) throw createHttpError(400, t('error.inputLong'));
  if (typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.sessionId) || body.sessionId === 'default') {
    throw createHttpError(400, t('error.session'));
  }
  if (body.model !== undefined && typeof body.model !== 'string') throw createHttpError(400, t('error.modelType'));
  if (body.turnId !== undefined && (typeof body.turnId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.turnId))) throw createHttpError(400, t('error.turnId'));
  const fileParts = resolveDeepseekFiles(body.fileIds ?? [], MODEL_INDEX.get(body.model));
  const ids = body.agentIds === undefined ? ['planner', 'researcher', 'writer'] : body.agentIds;
  if (!Array.isArray(ids) || ids.length > 3 || ids.some((id) => typeof id !== 'string' || !getAgent(id))) throw createHttpError(400, t('error.agentIds'));
  return { input: body.input.trim(), inputContent: fileParts.length ? [{ type: 'text', text: body.input.trim() }, ...fileParts] : body.input.trim(), model: body.model || 'deepseek-chat', sessionId: body.sessionId, agentIds: [...new Set(ids)], turnId: body.turnId || randomUUID() };
}

function createAgentService({ checkpointer = createMemoryStore(), modelFactory = createChatModel, toolsFactory = createAgentTools, bootstrap = legacyHistory, memoryOptions } = {}) {
  const active = new Set();
  async function runAgents(body, { emit = () => {}, signal } = {}) {
    const request = validateRequest(body);
    if (active.has(request.sessionId)) throw createHttpError(409, t('error.concurrent'));
    if (MODEL_INDEX.get(request.model)?.supportsTools === false && !MODEL_INDEX.get(request.model)?.supportsImageGeneration) throw createHttpError(400, t('error.modelTools'));
    active.add(request.sessionId);
    try {
      if (MODEL_INDEX.get(request.model)?.supportsImageGeneration) return await runImageGeneration(request, { emit, signal });
      const model = modelFactory(request.model);
      const tools = toolsFactory(model, request.agentIds);
      const graph = createGraph({ model, tools, checkpointer, emit, memoryOptions });
      const config = { configurable: { thread_id: request.sessionId }, signal, recursionLimit: 32 };
      const previous = await graph.getState(config);
      const history = previous.values.history ?? bootstrap(request.sessionId);
      let workingHistory = history;
      if (history.some((message) => message.id === request.turnId)) {
        if (previous.values.lastTurnId !== request.turnId || JSON.stringify(history.at(-2)?.content) !== JSON.stringify(request.inputContent)) {
          throw createHttpError(409, t('error.regenerate'));
        }
        workingHistory = history.slice(0, -2);
      }
      signal?.throwIfAborted();
      emit({ type: 'start', sessionId: request.sessionId, memoryMessages: workingHistory.length });
      const result = await graph.invoke({
        input: request.input, inputContent: request.inputContent, history, workingHistory, turnId: request.turnId,
        summary: previous.values.summary || '', summarizedMessages: previous.values.summarizedMessages || 0,
        steps: [], output: '', iteration: 0, artifacts: [],
      }, config);
      signal?.throwIfAborted();
      const response = { id: randomUUID(), sessionId: request.sessionId, input: request.input, output: result.output, steps: result.steps, memoryMessages: result.history.length, artifacts: result.artifacts || [] };
      emit({ type: 'done', result: response });
      return response;
    } finally { active.delete(request.sessionId); }
  }
  return { runAgents };
}
let service;
function runAgents(body, options) {
  service ??= createAgentService();
  return service.runAgents(body, options);
}
module.exports = { runAgents, createAgentService, validateRequest };
