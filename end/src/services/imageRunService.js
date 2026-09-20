const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { randomUUID } = require('node:crypto');
const { createArtifactTools } = require('../agents/artifactTools');
const { imageSchema } = require('./imageService');
const { t } = require('../i18n');
const { createHttpError } = require('../utils/http');

// Image models do not implement chat completions or tool calling. Execute the
// LangChain image tool directly in a dedicated LangGraph workflow.
async function runImageGeneration(request, { emit = () => {}, signal, tools = createArtifactTools() } = {}) {
  const parsed = imageSchema.safeParse({ title: request.input.slice(0, 60), prompt: request.input });
  if (!parsed.success) throw createHttpError(400, parsed.error.issues.map(issue => issue.message).join('; '));
  const args = parsed.data;
  const id = randomUUID();
  const step = { id, toolCallId: id, agentId: 'generate_image', phase: 'action', stage: 'executing', status: 'running', output: JSON.stringify(args) };
  emit({ type: 'start', sessionId: request.sessionId, memoryMessages: 0 });
  emit({ type: 'step', step: { ...step } });
  emit({ type: 'preview', preview: { id, toolCallId: id, format: 'png', status: 'generating', title: args.title, content: args.prompt } });
  const State = Annotation.Root({ artifact: Annotation(), output: Annotation() });
  const graph = new StateGraph(State).addNode('generate', async () => {
    const tool = tools.find(item => item.name === 'generate_image');
    let artifact;
    const message = await tool.invoke({ type: 'tool_call', id, name: 'generate_image', args }, {
      signal, configurable: { onArtifact: file => {
        artifact = { ...file, toolCallId: id };
        emit({ type: 'artifact', artifact });
      } },
    });
    return { artifact, output: message.content };
  }).addEdge(START, 'generate').addEdge('generate', END).compile();
  try {
    const result = await graph.invoke({}, { signal });
    signal?.throwIfAborted();
    step.status = 'completed';
    emit({ type: 'step', step: { ...step } });
    const observation = { id: randomUUID(), toolCallId: id, agentId: 'generate_image', phase: 'observation', status: 'completed', output: result.output };
    emit({ type: 'step', step: observation });
    const response = { id: randomUUID(), sessionId: request.sessionId, input: request.input, output: t('artifact.ready'), steps: [step, observation], memoryMessages: 0, artifacts: [result.artifact] };
    emit({ type: 'done', result: response });
    return response;
  } catch (error) {
    step.status = signal?.aborted ? 'cancelled' : 'failed';
    emit({ type: 'step', step: { ...step } });
    emit({ type: 'preview', preview: { id, toolCallId: id, format: 'png', status: step.status, title: args.title, content: args.prompt } });
    throw error;
  }
}
module.exports = { runImageGeneration };
