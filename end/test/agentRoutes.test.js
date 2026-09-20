const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAgentRouter } = require('../src/routes/agentRoutes');

async function serve(t, run) {
  const app = express();
  app.use(express.json());
  app.use('/api', createAgentRouter(run));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return (body, options = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/agents/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), ...options,
  });
}

test('HTTP sends SSE before execution finishes, then delivers delta and done', { timeout: 5000 }, async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  t.after(release);
  const post = await serve(t, async (body, { emit }) => {
    emit({ type: 'start', sessionId: body.sessionId, memoryMessages: 0 });
    await gate;
    emit({ type: 'delta', text: '42' });
    emit({ type: 'done', result: { output: '42' } });
  });
  const response = await post({ input: '6*7', sessionId: 'http-stream', stream: true });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /"type":"start"/);
  assert.doesNotMatch(first, /"type":"done"/);
  release();
  let rest = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += new TextDecoder().decode(value);
  }
  assert.match(rest, /"type":"delta"/);
  assert.match(rest, /"type":"done"/);
});

test('HTTP preserves validation errors and reports errors after SSE starts', { timeout: 5000 }, async (t) => {
  const post = await serve(t, async (body, { emit }) => {
    if (!body.sessionId) throw Object.assign(new Error('sessionId 不能为空'), { status: 400 });
    emit({ type: 'start', sessionId: body.sessionId, memoryMessages: 0 });
    throw new Error('上游测试错误');
  });
  const invalid = await post({ input: 'hello', stream: true });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).msg, 'sessionId 不能为空');
  const failed = await post({ input: 'hello', sessionId: 'http-failed', stream: true });
  assert.equal(failed.status, 200);
  const events = await failed.text();
  assert.match(events, /"type":"error","message":"上游测试错误"/);
  assert.doesNotMatch(events, /"type":"done"/);
});

test('closing the HTTP stream aborts the running agent', { timeout: 5000 }, async (t) => {
  let onAborted;
  const aborted = new Promise((resolve) => { onAborted = resolve; });
  const post = await serve(t, async (body, { emit, signal }) => {
    const waiting = new Promise((resolve) => signal.addEventListener('abort', () => {
      onAborted();
      resolve();
    }, { once: true }));
    emit({ type: 'start', sessionId: body.sessionId, memoryMessages: 0 });
    await waiting;
    signal.throwIfAborted();
  });
  const controller = new AbortController();
  const response = await post({ input: 'hello', sessionId: 'http-abort', stream: true }, { signal: controller.signal });
  const reader = response.body.getReader();
  await reader.read();
  controller.abort();
  await aborted;
  await reader.cancel().catch(() => {});
});
