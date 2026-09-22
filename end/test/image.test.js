const test = require('node:test');
const assert = require('node:assert/strict');
const { generateImageFile } = require('../src/services/imageService');
const { createArtifactTools } = require('../src/agents/artifactTools');
const { createLivePreviewEmitter } = require('../src/agents/livePreview');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const input = { title: '测试图片', prompt: 'A cat', size: '1536*1024' };
const response = url => ({ data: { output: { choices: [{ message: { content: [{ image: url }] } }] } } });
const imageUrl = 'https://dashscope-result.oss-cn-beijing.aliyuncs.com/test.png';

test('Qwen image contract, local PNG and LangChain ToolMessage artifact', async () => {
  const http = {
    async post(url, body, config) {
      assert.equal(body.model, 'qwen-image-2.0');
      assert.deepEqual(body.input.messages, [{ role: 'user', content: [{ text: input.prompt }] }]);
      assert.equal(body.parameters.n, 1);
      assert.equal(body.parameters.size, input.size);
      assert.equal(config.headers.Authorization, 'Bearer test-key');
      return response(imageUrl);
    },
    async get(url, config) {
      assert.equal(url, imageUrl); assert.equal(config.headers, undefined);
      assert.equal(config.maxRedirects, 0); return { data: png };
    },
  };
  const events = [];
  const target = createArtifactTools({
    generateImage: (args, options) => generateImageFile(args, { ...options, http, apiKey: 'test-key' }),
    saveFile(file) { assert.equal(file.mimeType, 'image/png'); assert.deepEqual(file.buffer, png); return { fileId: 'image-test', fileName: file.fileName, mimeType: file.mimeType, size: png.length, storageProvider: 'local' }; },
  }).find(tool => tool.name === 'generate_image');
  const result = await target.invoke({ name: 'generate_image', args: input, id: 'image-call', type: 'tool_call' }, { configurable: { onArtifact: artifact => events.push(artifact) } });
  assert.equal(result._getType(), 'tool');
  assert.equal(result.tool_call_id, 'image-call');
  assert.equal(JSON.parse(result.content).format, 'png');
  assert.equal(events[0].downloadPath, '/api/files/image-test/download');
});

test('image validation, missing credentials and cancellation never call provider', async () => {
  const http = { post() { assert.fail('provider must not be called'); } };
  await assert.rejects(generateImageFile({ ...input, size: '1*1' }, { http, apiKey: 'test' }));
  await assert.rejects(generateImageFile(input, { http, apiKey: '' }), { status: 503 });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(generateImageFile(input, { http, apiKey: 'test', signal: controller.signal }), { name: 'AbortError' });
});

test('provider errors, unsafe URLs and non-PNG responses never become artifacts', async () => {
  for (const url of ['http://127.0.0.1/a', 'https://evil.test/a', 'https://aliyuncs.com.evil.test/a']) {
    await assert.rejects(generateImageFile(input, { apiKey: 'test', http: {
      post: async () => response(url), get() { assert.fail('unsafe fetch'); },
    } }), { status: 502 });
  }
  await assert.rejects(generateImageFile(input, { apiKey: 'test', http: {
    post: async () => ({ data: { code: 'InvalidApiKey' } }),
  } }), /InvalidApiKey/);
  await assert.rejects(generateImageFile(input, { apiKey: 'test', http: {
    post: async () => response(imageUrl), get: async () => ({ data: Buffer.from('<html>error</html>') }),
  } }), { status: 502 });
});

test('image drafts expose prompt and generation/failure status without pretending to stream pixels', () => {
  const events = [];
  const preview = createLivePreviewEmitter(event => events.push(event));
  const action = { id: 'a', toolCallId: 'call', agentId: 'generate_image' };
  preview(action, 'saving', true, input);
  assert.equal(events[0].preview.format, 'png');
  assert.equal(events[0].preview.status, 'generating');
  assert.equal(events[0].preview.content, 'A cat');
  preview(action, 'failed', true, input);
  assert.equal(events[1].preview.status, 'failed');
});

const { MODEL_CATALOG, getEnabledModels } = require('../src/config/models');
const { createChatModel } = require('../src/models/chatModel');
const { createAgentTools } = require('../src/agents/tools');
const { runImageGeneration } = require('../src/services/imageRunService');
test('only the image model advertises generation; chat models do not receive the tool', () => {
  assert.deepEqual(getEnabledModels().filter(item => item.supportsImageGeneration).map(item => item.id), ['qwen-image-2.0']);
  assert.equal(MODEL_CATALOG.find(item => item.id === 'qwen-image-2.0').supportsThinking, false);
  assert.throws(() => createChatModel('qwen-image-2.0'), { status: 400 });
  assert.ok(!createAgentTools({}, []).some(item => item.name === 'generate_image'));
});
test('dedicated image graph invokes generation directly without a chat model and streams artifacts', async () => {
  const events = [];
  const tools = createArtifactTools({ generateImage: async args => ({ title: args.title, format: 'png', fileName: 'test.png', mimeType: 'image/png', buffer: png }), saveFile: file => ({ fileId: 'image-test', fileName: file.fileName, mimeType: file.mimeType, size: png.length, storageProvider: 'local' }) });
  const result = await runImageGeneration({ input: 'A cat', sessionId: 'image-session' }, { tools, emit: event => events.push(event) });
  assert.equal(result.artifacts[0].format, 'png');
  assert.equal(events[0].type, 'start');
  assert.equal(events.at(-1).type, 'done');
  assert.ok(events.findIndex(event => event.type === 'preview') < events.findIndex(event => event.type === 'artifact'));
});
