const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AIMessageChunk, HumanMessage, AIMessage } = require('@langchain/core/messages');
const { createAgentService } = require('../src/services/agentService');
const { createMemoryStore } = require('../src/agents/memoryStore');
const { createAgentTools } = require('../src/agents/tools');
const { createGraph } = require('../src/agents/graph');
const { prepareContext } = require('../src/agents/contextMemory');

function fixture(t, modelFactory) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-tests-'));
  const file = path.join(dir, 'memory.sqlite');
  const saver = createMemoryStore(file);
  t.after(() => { saver.db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const options = { checkpointer: saver, modelFactory, bootstrap: () => [] };
  return { file, saver, service: createAgentService(options), options };
}
function fakeModel(answer) {
  return { bindTools() { return this; }, async *stream(messages, config) {
    const chunks = await answer(messages, config);
    for (const chunk of chunks) yield typeof chunk === 'string' ? new AIMessageChunk(chunk) : chunk;
  } };
}

test('ReAct executes a real calculator tool, streams deltas, and starts fresh steps each turn', async (t) => {
  const model = fakeModel(async (messages) => messages.at(-1)._getType() === 'tool'
    ? ['结果', '是 42']
    : [new AIMessageChunk({ content: '', tool_calls: [{ id: 'calc-1', name: 'calculate', args: { operation: 'multiply', values: [6, 7] }, type: 'tool_call' }] })]);
  const { service } = fixture(t, () => model);
  const events = [];
  const first = await service.runAgents({ input: '6*7', sessionId: 'math' }, { emit: (e) => events.push(structuredClone(e)) });
  assert.equal(first.output, '结果是 42');
  assert.equal(first.steps.filter((s) => s.phase === 'observation')[0].output, '{"result":42}');
  assert.ok(events.find((e) => e.type === 'step' && e.step.status === 'running'));
  assert.deepEqual(events.filter((e) => e.type === 'delta').map((e) => e.text), ['结果', '是 42']);
  assert.equal(events.at(-1).type, 'done');
  const second = await service.runAgents({ input: '再算一次', sessionId: 'math' });
  assert.equal(second.steps.length, first.steps.length);
  assert.equal(second.memoryMessages, 4);
});

test('official SQLite checkpoint survives reopening and isolates threads', async (t) => {
  const seen = [];
  const model = fakeModel(async (messages) => { seen.push(messages); return ['收到']; });
  const { service, file } = fixture(t, () => model);
  await service.runAgents({ input: '我的代号是青石', sessionId: 'a' });
  const reopened = createMemoryStore(file);
  t.after(() => reopened.db.close());
  const restarted = createAgentService({ checkpointer: reopened, modelFactory: () => model, bootstrap: () => [] });
  await restarted.runAgents({ input: '我的代号?', sessionId: 'a' });
  assert.ok(seen.at(-1).some((m) => m.content === '我的代号是青石'));
  await restarted.runAgents({ input: '你好', sessionId: 'b' });
  assert.ok(!seen.at(-1).some((m) => m.content === '我的代号是青石'));
});

test('failed and cancelled turns do not pollute next turn; same-thread overlap is rejected', async (t) => {
  let mode = 'ok';
  let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const seen = [];
  const model = fakeModel(async (messages, { signal }) => {
    seen.push(messages);
    if (mode === 'fail') throw new Error('upstream unavailable');
    if (mode === 'wait') { entered(); await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); }
    return ['完成'];
  });
  const { service } = fixture(t, () => model);
  await service.runAgents({ input: '已完成记忆', sessionId: 'a' });
  mode = 'fail';
  await assert.rejects(service.runAgents({ input: '失败内容', sessionId: 'a' }));
  mode = 'wait';
  const controller = new AbortController();
  const pending = service.runAgents({ input: '取消内容', sessionId: 'a' }, { signal: controller.signal });
  const rejection = assert.rejects(pending);
  await waiting;
  await assert.rejects(service.runAgents({ input: '并发', sessionId: 'a' }), { status: 409 });
  controller.abort();
  await rejection;
  mode = 'ok';
  await service.runAgents({ input: '继续', sessionId: 'a' });
  const contents = seen.at(-1).map((m) => m.content);
  assert.ok(contents.includes('已完成记忆'));
  assert.ok(!contents.includes('失败内容') && !contents.includes('取消内容'));
});

test('invalid session, model and tools fail explicitly, and calculator never evaluates code', async (t) => {
  const { service } = fixture(t, () => { throw Object.assign(new Error('unknown model'), { status: 400 }); });
  for (const body of [null, { input: 'x' }, { input: 'x', sessionId: 'default' }, { input: 'x', sessionId: 'ok', agentIds: ['invalid'] }]) {
    await assert.rejects(service.runAgents(body), { status: 400 });
  }
  await assert.rejects(service.runAgents({ input: 'x', sessionId: 'ok', model: 'invalid' }), { status: 400 });
  const calculator = createAgentTools({}, [])[0];
  await assert.rejects(calculator.invoke({ operation: 'divide', values: [1, 0] }));
  await assert.rejects(calculator.invoke({ operation: 'add', values: ['process.exit()', 1] }));
});

test('truncated answers are rejected and excluded from successful memory', async (t) => {
  let truncated = true;
  const seen = [];
  const model = fakeModel(async (messages) => {
    seen.push(messages);
    return [new AIMessageChunk({ content: '部分答案', response_metadata: { finish_reason: truncated ? 'length' : 'stop' } })];
  });
  const { service } = fixture(t, () => model);
  await assert.rejects(service.runAgents({ input: '未完成的任务', sessionId: 'truncated' }), { status: 502 });
  truncated = false;
  await service.runAgents({ input: '新任务', sessionId: 'truncated' });
  assert.ok(!seen.at(-1).some((message) => message.content === '未完成的任务'));
});

test('regeneration replaces only the last turn; failed retries preserve committed history', async (t) => {
  let fail = false;
  let answer = '原答复';
  const seen = [];
  const model = fakeModel(async (messages) => {
    seen.push(messages);
    if (fail) throw new Error('upstream failed');
    return [answer];
  });
  const { service, file, options } = fixture(t, () => model);
  const request = { input: '我的代号是青石', sessionId: 'retry', turnId: 'turn-one' };
  await service.runAgents(request);
  fail = true;
  await assert.rejects(service.runAgents(request));
  const state = await createGraph({ model, tools: [], checkpointer: options.checkpointer }).getState({ configurable: { thread_id: 'retry' } });
  assert.deepEqual(state.values.history.map((m) => m.content), [request.input, '原答复']);
  fail = false;
  answer = '新答复';
  const reopened = createMemoryStore(file);
  t.after(() => reopened.db.close());
  const restarted = createAgentService({ ...options, checkpointer: reopened });
  const result = await restarted.runAgents(request);
  assert.equal(result.memoryMessages, 2);
  assert.ok(!seen.at(-1).some((m) => m.content === '原答复'));
  assert.equal(seen.at(-1).filter((m) => m.content === request.input).length, 1);
  await assert.rejects(restarted.runAgents({ ...request, input: '修改旧输入' }), { status: 409 });
  await restarted.runAgents({ input: '下一轮', sessionId: 'retry', turnId: 'turn-two' });
  assert.ok(seen.at(-1).some((m) => m.content === '新答复'));
  assert.ok(!seen.at(-1).some((m) => m.content === '原答复'));
  await assert.rejects(restarted.runAgents(request), { status: 409 });
});

test('memory summarizes old turns, retains recent originals, persists and extends the summary', async (t) => {
  const prompts = [];
  const summaryInputs = [];
  let fail = false;
  const model = fakeModel(async (messages) => {
    if (messages[0].content.includes('会话记忆整理器')) {
      summaryInputs.push(JSON.parse(messages[1].content));
      return ['用户代号是青石，目标是完成工程。'];
    }
    prompts.push(messages);
    if (fail) throw new Error('answer failed');
    return ['收到'];
  });
  const { service, file, options } = fixture(t, () => model);
  for (let i = 0; i < 4; i++) await service.runAgents({ input: `第${i}轮：我的代号是青石，目标是完成工程。`, sessionId: 'long', turnId: `turn-${i}` });
  const reopened = createMemoryStore(file);
  t.after(() => reopened.db.close());
  const memoryOptions = { contextChars: 30, recentMessages: 2, batchChars: 55, summaryChars: 100 };
  const restarted = createAgentService({ ...options, checkpointer: reopened, memoryOptions });
  const graph = createGraph({ model, tools: [], checkpointer: reopened });
  const config = { configurable: { thread_id: 'long' } };
  fail = true;
  await assert.rejects(restarted.runAgents({ input: '失败轮次', sessionId: 'long' }));
  let state = (await graph.getState(config)).values;
  assert.equal(state.history.length, 8);
  assert.equal(state.summary, '');
  assert.equal(state.summarizedMessages, 0);
  fail = false;
  const events = [];
  await restarted.runAgents({ input: '我的代号？', sessionId: 'long', turnId: 'recall' }, { emit: (event) => events.push(event) });
  state = (await graph.getState(config)).values;
  assert.equal(state.summarizedMessages, 6);
  assert.match(state.summary, /青石/);
  assert.equal(state.history.length, 10);
  assert.ok(prompts.at(-1).some((m) => m.content.startsWith('以下是历史会话')));
  assert.ok(prompts.at(-1).some((m) => m.content.startsWith('第3轮')));
  assert.ok(!prompts.at(-1).some((m) => m.content.startsWith('第0轮')));
  assert.ok(!prompts.at(-1).some((m) => m.content === '失败轮次'));
  assert.ok(events.some((e) => e.type === 'memory' && e.summarizedMessages === 6 && e.recentMessages === 2));
  assert.ok(summaryInputs.every((input) => input.historicalMessages.length <= 55));
  const third = createAgentService({ ...options, checkpointer: reopened, memoryOptions });
  await third.runAgents({ input: '继续', sessionId: 'long' });
  assert.ok(summaryInputs.at(-1).previousSummary.includes('青石'));
  assert.equal((await graph.getState(config)).values.summarizedMessages, 8);
  await third.runAgents({ input: '新会话', sessionId: 'isolated' });
  assert.ok(!prompts.at(-1).some((m) => m.content.includes('青石')));
});

test('memory chunking preserves oversized historical text; invalid or aborted summaries fail explicitly', async () => {
  const longText = 'x'.repeat(300) + '末尾重要代号';
  const history = [new HumanMessage(longText), new AIMessage('旧答复'), new HumanMessage('近期'), new AIMessage('近期答复')];
  const batches = [];
  const options = { contextChars: 50, recentMessages: 2, batchChars: 80, summaryChars: 100 };
  const model = fakeModel(async (messages) => { batches.push(JSON.parse(messages[1].content).historicalMessages); return ['摘要']; });
  const result = await prepareContext({ history, model, options });
  assert.ok(batches.length > 1);
  assert.ok(batches.join('').includes(longText));
  assert.equal(result.messages.at(-2).content, '近期');
  for (const invalid of ['', 'x'.repeat(101), new AIMessageChunk({ content: '摘要', response_metadata: { finish_reason: 'length' } })]) {
    await assert.rejects(prepareContext({ history, model: fakeModel(async () => [invalid]), options }), { status: 502 });
  }
  const controller = new AbortController();
  const cancelling = fakeModel(async () => { controller.abort(); return ['摘要']; });
  await assert.rejects(prepareContext({ history, model: cancelling, options, signal: controller.signal }), { name: 'AbortError' });
});

test('ReAct streams thought text, tool arguments and delegated observations before nodes finish', { timeout: 5000 }, async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  t.after(release);
  let receivedObservation;
  const observationReceived = new Promise((resolve) => { receivedObservation = resolve; });
  const model = {
    bindTools() { return this; },
    async *stream(messages) {
      if (messages[0].content.includes('负责整合输出')) {
        yield new AIMessageChunk('第一段');
        await gate;
        yield new AIMessageChunk('第二段');
      } else if (messages.at(-1)._getType() === 'tool') {
        yield new AIMessageChunk('最终');
        yield new AIMessageChunk('答复');
      } else {
        yield new AIMessageChunk('先委派');
        yield new AIMessageChunk('写作智能体。');
        yield new AIMessageChunk({ content: '', tool_call_chunks: [{ id: 'writer-stream', name: 'delegate_writer', index: 0, args: '{"task":"写', type: 'tool_call_chunk' }] });
        yield new AIMessageChunk({ content: '', tool_call_chunks: [{ index: 0, args: '两段"}', type: 'tool_call_chunk' }] });
      }
    },
  };
  const { service } = fixture(t, () => model);
  const events = [];
  const pending = service.runAgents({ input: '委派写作', sessionId: 'stream-delegate' }, { emit: (event) => {
    events.push(structuredClone(event));
    if (event.type === 'step_delta' && event.text === '第一段') receivedObservation();
  } });
  await observationReceived;
  assert.ok(!events.some((event) => event.type === 'done'));
  const partial = events.find((event) => event.type === 'step_delta' && event.text === '第一段');
  assert.ok(events.some((event) => event.type === 'step' && event.step.id === partial.stepId && event.step.phase === 'observation' && event.step.status === 'running'));
  assert.ok(events.some((event) => event.type === 'step_delta' && event.text === '先委派' && event.reset));
  assert.ok(events.some((event) => event.type === 'step_delta' && event.text === '{"task":"写'));
  release();
  const result = await pending;
  assert.equal(result.output, '最终答复');
  assert.equal(result.steps.find((step) => step.phase === 'observation').output, '第一段第二段');
  assert.equal(result.steps.filter((step) => step.phase === 'action').length, 1);
  assert.ok(result.steps.every((step) => step.status === 'completed'));
});

test('cancelling during a delegated delta stops the run and preserves successful memory', { timeout: 5000 }, async (t) => {
  const controller = new AbortController();
  let delegate = false;
  const seen = [];
  const model = {
    bindTools() { return this; },
    async *stream(messages, { signal }) {
      if (messages[0].content.includes('负责整合输出')) {
        yield new AIMessageChunk('未完成的子智能体文本');
        signal.throwIfAborted();
        throw new Error('should not continue after cancellation');
      }
      seen.push(messages);
      if (delegate) yield new AIMessageChunk({ content: '', tool_calls: [{ id: 'cancel-delegate', name: 'delegate_writer', args: { task: '写作' }, type: 'tool_call' }] });
      else yield new AIMessageChunk('已完成');
    },
  };
  const { service } = fixture(t, () => model);
  await service.runAgents({ input: '保留这个事实', sessionId: 'cancel-stream' });
  delegate = true;
  const events = [];
  await assert.rejects(service.runAgents({ input: '取消的任务', sessionId: 'cancel-stream' }, {
    signal: controller.signal,
    emit: (event) => {
      events.push(structuredClone(event));
      if (event.type === 'step_delta' && event.text === '未完成的子智能体文本') controller.abort();
    },
  }), { name: 'AbortError' });
  assert.ok(!events.some((event) => event.type === 'done'));
  delegate = false;
  const result = await service.runAgents({ input: '继续', sessionId: 'cancel-stream' });
  assert.equal(result.memoryMessages, 4);
  assert.ok(seen.at(-1).some((message) => message.content === '保留这个事实'));
  assert.ok(!seen.at(-1).some((message) => message.content === '取消的任务'));
});
