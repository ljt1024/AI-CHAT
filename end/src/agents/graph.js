const { t, getLanguage } = require('../i18n');
const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { AIMessage, HumanMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const { messageText } = require('./tools');
const { createHttpError } = require('../utils/http');
const { randomUUID } = require('node:crypto');
const { prepareContext } = require('./contextMemory');
const { createLivePreviewEmitter } = require('./livePreview');

const State = Annotation.Root({
  messages: Annotation(), history: Annotation(), steps: Annotation(), input: Annotation(),
  output: Annotation(), iteration: Annotation(),
  summary: Annotation(), summarizedMessages: Annotation(),
  workingHistory: Annotation(), pendingSummary: Annotation(), pendingSummarizedMessages: Annotation(),
  turnId: Annotation(), lastTurnId: Annotation(),
  artifacts: Annotation(),
});

function createGraph({ model, tools, checkpointer, emit = () => {}, maxIterations = 12, memoryOptions }) {
  const boundModel = model.bindTools(tools);
  const preview = createLivePreviewEmitter(emit);
  const instruction = new SystemMessage(
    t('agent.prompt') +
    t('agent.calculationPrompt') +
    t('agent.artifactPrompt') +
    t('agent.explanationPrompt') + ` Default response language: ${getLanguage() === 'en' ? 'English' : 'Chinese'}. Follow any explicit language request from the user.`
  );
  const localized = (key, params = {}) => ({ output: t(key, params), outputTranslation: { key: `server.${key}`, params } });
  const step = (phase, output, extra = {}) => {
    const value = { id: randomUUID(), phase, status: 'completed', output, ...extra };
    emit({ type: 'step', step: value });
    return value;
  };
  return new StateGraph(State)
    .addNode('context', async (state, config) => {
      let progress;
      const context = await prepareContext({
        history: state.workingHistory, summary: state.summary,
        summarizedMessages: state.summarizedMessages, model, signal: config.signal, options: memoryOptions,
        onProgress: ({ status, count }) => {
          if (!progress) progress = step('thought', t('memory.preparing', { p0: count }), { status, ...localized('memory.preparing', { p0: count }) });
          else {
            progress = { ...progress, status, ...localized('memory.completed', { p0: count }) };
            emit({ type: 'step', step: progress });
          }
        },
      });
      emit({ type: 'memory', summarizedMessages: context.summarizedMessages, recentMessages: state.workingHistory.length - context.summarizedMessages });
      return {
        messages: [...context.messages, new HumanMessage(state.input)],
        pendingSummary: context.summary, pendingSummarizedMessages: context.summarizedMessages,
        steps: progress ? [progress] : [],
      };
    })
    .addNode('reason', async (state, config) => {
      if (state.iteration >= maxIterations) throw createHttpError(422, t('agent.iterationLimit'));
      const thinking = step('thought', state.iteration
        ? t('agent.checking', { p0: state.iteration })
        : t('agent.analyzing', { p0: state.workingHistory.length }), { status: 'running', ...localized(state.iteration ? 'agent.checking' : 'agent.analyzing', { p0: state.iteration || state.workingHistory.length }) });
      emit({ type: 'answer_start' });
      let message;
      let streamedText = false;
      const preparing = new Map();
      for await (const chunk of await boundModel.stream([instruction, ...state.messages], { signal: config.signal })) {
        config.signal?.throwIfAborted();
        message = message ? message.concat(chunk) : chunk;
        const text = messageText(chunk);
        if (text) {
          if (!streamedText) { thinking.output = ''; delete thinking.outputTranslation; }
          thinking.output += text;
          emit({ type: 'step_delta', stepId: thinking.id, text, reset: !streamedText });
          streamedText = true;
          emit({ type: 'delta', text });
        }
        // Tool-call JSON arrives incrementally, before the tool can execute.
        for (const part of chunk.tool_call_chunks || []) {
          const index = part.index ?? 0;
          let action = preparing.get(index);
          if (!action) {
            action = step('action', '', { status: 'running', agentId: part.name || undefined, toolCallId: part.id || undefined, stage: 'preparing' });
            preparing.set(index, action);
          }
          if (part.name || part.id) {
            action.agentId = part.name || action.agentId;
            action.toolCallId = part.id || action.toolCallId;
            emit({ type: 'step', step: { ...action } });
          }
          if (part.args) {
            action.output += part.args;
            emit({ type: 'step_delta', stepId: action.id, text: part.args });
          }
          preview(action);
        }
      }
      if (!message || (!messageText(message) && !message.tool_calls?.length)) throw createHttpError(502, t('agent.empty'));
      if (message.response_metadata?.finish_reason === 'length') throw createHttpError(502, t('agent.truncated'));
      thinking.status = 'completed';
      if (messageText(message)) {
        thinking.output = messageText(message);
        delete thinking.outputTranslation;
      } else Object.assign(thinking, localized(message.tool_calls?.length ? 'agent.selectedTools' : 'agent.answerReady', {
        p0: message.tool_calls?.map((call) => call.name).join(', ') || '',
      }));
      emit({ type: 'step', step: thinking });
      for (const action of preparing.values()) {
        if (!message.tool_calls?.some((call) => call.id === action.toolCallId)) throw createHttpError(502, t('agent.invalidArguments'));
        preview(action, 'generating', true);
      }
      return { messages: [...state.messages, message], steps: [...state.steps, thinking, ...preparing.values()], iteration: state.iteration + 1 };
    })
    .addNode('tools', async (state, config) => {
      const messages = [...state.messages];
      const steps = [...state.steps];
      const artifacts = [...(state.artifacts || [])];
      for (const call of state.messages.at(-1).tool_calls) {
        config.signal?.throwIfAborted();
        const prepared = steps.find((item) => item.phase === 'action' && item.toolCallId === call.id && item.status === 'running');
        const action = prepared || step('action', '', { agentId: call.name, status: 'running', toolCallId: call.id });
        action.output = JSON.stringify(call.args);
        action.stage = 'executing';
        preview(action, 'saving', true, call.args);
        emit({ type: 'step', step: { ...action } });
        if (!prepared) steps.push(action);
        const observation = step('observation', '', { agentId: call.name, status: 'running', toolCallId: call.id });
        steps.push(observation);
        const target = tools.find((item) => item.name === call.name);
        let output;
        let failed = false;
        try {
          if (!target) throw new Error(t('agent.unknownTool', { p0: call.name }));
          output = await target.invoke(call.args, {
            signal: config.signal,
            configurable: { onArtifact: (artifact) => {
              artifact.toolCallId = call.id;
              artifacts.push(artifact);
              emit({ type: 'artifact', artifact });
            }, onPreview: (draft) => {
              preview(action, draft.complete ? 'saving' : 'generating', true, {
                title: draft.title,
                html: draft.content,
              });
            }, onToolDelta: (text) => {
              config.signal?.throwIfAborted();
              observation.output += text;
              emit({ type: 'step_delta', stepId: observation.id, text });
            } },
          });
          if (typeof output !== 'string') output = JSON.stringify(output);
        } catch (error) {
          config.signal?.throwIfAborted();
          failed = true;
          output = t('agent.toolFailed', { p0: error.message });
        }
        config.signal?.throwIfAborted();
        action.status = failed ? 'failed' : 'completed';
        if (failed) preview(action, 'failed', true, call.args);
        emit({ type: 'step', step: action });
        observation.output = failed && observation.output ? `${observation.output}\n\n${output}` : output;
        observation.status = action.status;
        emit({ type: 'step', step: { ...observation } });
        messages.push(new ToolMessage({ content: output, tool_call_id: call.id, name: call.name }));
      }
      return { messages, steps, artifacts };
    })
    .addNode('remember', async (state, config) => {
      config.signal?.throwIfAborted();
      const answer = state.messages.at(-1);
      const files = state.artifacts || [];
      const memoryAnswer = files.length ? new AIMessage(t('memory.files', { p0: messageText(answer), p1: files.map((file) => `${file.fileName}: ${file.downloadPath}`).join('\n') })) : answer;
      return {
        history: [...state.workingHistory, new HumanMessage({ content: state.input, id: state.turnId }), memoryAnswer],
        output: messageText(answer), summary: state.pendingSummary,
        summarizedMessages: state.pendingSummarizedMessages, lastTurnId: state.turnId,
      };
    })
    .addEdge(START, 'context')
    .addEdge('context', 'reason')
    .addConditionalEdges('reason', (state) => state.messages.at(-1).tool_calls?.length ? 'tools' : 'remember')
    .addEdge('tools', 'reason')
    .addEdge('remember', END)
    .compile({ checkpointer });
}
module.exports = { createGraph };
