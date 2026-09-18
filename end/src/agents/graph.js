const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { AIMessage, HumanMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const { messageText } = require('./tools');
const { createHttpError } = require('../utils/http');
const { randomUUID } = require('node:crypto');
const { prepareContext } = require('./contextMemory');

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
  const instruction = new SystemMessage(
    '你是解决用户问题的主智能体。利用会话记忆理解原始目标。需要时调用计算工具或委派规划、分析、写作智能体，读取工具结果后再判断下一步，直到能回答或需要用户补充信息。' +
    '计算必须调用 calculate。工具失败时可修正参数重试。简单问题直接回答，不要机械调用所有工具。' +
    '用户要求PDF、Excel或PPT下载时，必须调用export_pdf、export_excel或export_pptx实际生成文件；只使用工具返回的下载地址，不得虚构文件链接。正文或数据不足时先澄清，示例数据须明确标注。生成成功后简短告知用户点击下载卡片。' +
    '调用工具时，尽可能同时输出一句面向用户的执行说明，说明要做什么以及目的。输出简短决策说明、工具结果摘要和最终答案，不输出内部推理草稿。不要虚构联网、文件操作或不存在的工具。'
  );
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
          if (!progress) progress = step('thought', `正在整理 ${count} 条较早会话记忆，保留近期原文。`, { status });
          else {
            progress = { ...progress, status, output: `已整理 ${count} 条较早会话记忆。` };
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
      if (state.iteration >= maxIterations) throw createHttpError(422, '本轮达到执行步数上限，请缩小任务范围后重试。');
      const thinking = step('thought', state.iteration
        ? `正在检查第 ${state.iteration} 轮工具结果，决定下一步。`
        : `正在结合 ${state.workingHistory.length} 条会话记忆分析任务。`, { status: 'running' });
      emit({ type: 'answer_start' });
      let message;
      let streamedText = false;
      const preparing = new Map();
      for await (const chunk of await boundModel.stream([instruction, ...state.messages], { signal: config.signal })) {
        config.signal?.throwIfAborted();
        message = message ? message.concat(chunk) : chunk;
        const text = messageText(chunk);
        if (text) {
          if (!streamedText) thinking.output = '';
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
        }
      }
      if (!message || (!messageText(message) && !message.tool_calls?.length)) throw createHttpError(502, '模型返回了空内容');
      if (message.response_metadata?.finish_reason === 'length') throw createHttpError(502, '模型输出达到上游长度上限，本轮未完成，请拆分任务后重试。');
      thinking.status = 'completed';
      thinking.output = messageText(message) || (message.tool_calls?.length
        ? `已选择调用：${message.tool_calls.map((call) => call.name).join('、')}，获取结果后继续处理。`
        : '已结合当前任务与会话记忆整理答复。');
      emit({ type: 'step', step: thinking });
      for (const action of preparing.values()) {
        if (!message.tool_calls?.some((call) => call.id === action.toolCallId)) throw createHttpError(502, '模型返回了不完整的工具参数，请重试。');
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
        emit({ type: 'step', step: { ...action } });
        if (!prepared) steps.push(action);
        const observation = step('observation', '', { agentId: call.name, status: 'running', toolCallId: call.id });
        steps.push(observation);
        const target = tools.find((item) => item.name === call.name);
        let output;
        let failed = false;
        try {
          if (!target) throw new Error(`工具不存在: ${call.name}`);
          output = await target.invoke(call.args, {
            signal: config.signal,
            configurable: { onArtifact: (artifact) => {
              artifacts.push(artifact);
              emit({ type: 'artifact', artifact });
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
          output = `工具执行失败: ${error.message}`;
        }
        config.signal?.throwIfAborted();
        action.status = failed ? 'failed' : 'completed';
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
      const memoryAnswer = files.length ? new AIMessage(`${messageText(answer)}\n\n本轮已生成文件：\n${files.map((file) => `${file.fileName}: ${file.downloadPath}`).join('\n')}`) : answer;
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
