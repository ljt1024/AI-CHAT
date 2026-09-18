const test = require('node:test');
const assert = require('node:assert/strict');
const { AIMessageChunk } = require('@langchain/core/messages');
const { MemorySaver } = require('@langchain/langgraph');
const { createAgentService } = require('../src/services/agentService');
const { createArtifactTools } = require('../src/agents/artifactTools');
const { generateHtmlFile } = require('../src/services/htmlService');
const { generateSpreadsheetFile } = require('../src/services/spreadsheetService');
const { createLivePreviewEmitter } = require('../src/agents/livePreview');
const { randomUUID } = require('node:crypto');

test('partial tool JSON emits escaped HTML and independent draft IDs; unrelated tools emit nothing', () => {
  const events = [];
  const emit = createLivePreviewEmitter(event => events.push(event));
  emit({ id: 'html', agentId: 'export_html', output: '{"title":"页面","html":"<h1>你好\\n世界\\"' }, 'generating', true);
  assert.equal(events[0].preview.content, '<h1>你好\n世界"');
  emit({ id: 'other', agentId: 'calculate', output: '{}' }, 'generating', true);
  assert.equal(events.length, 1);
  emit({ id: 'pdf', agentId: 'export_pdf', output: '{"content":"报告' }, 'generating', true);
  assert.equal(events[1].preview.id, 'pdf');
  assert.equal(events[1].preview.content, '报告');
  emit({ id: 'pdf', agentId: 'export_pdf', output: '{"content":"报告' }, 'generating', true);
  assert.equal(events.length, 2);
});

test('preview reaches client while model is still generating; saved HTML becomes a ToolMessage', { timeout: 5000 }, async (t) => {
  let release, received;
  const gate = new Promise(resolve => { release = resolve; });
  const first = new Promise(resolve => { received = resolve; });
  t.after(release);
  const saved = [];
  const events = [];
  const model = {
    bindTools() { return this; },
    async *stream(messages) {
      if (messages.at(-1)._getType() === 'tool') {
        assert.match(messages.at(-1).content, /download/);
        assert.equal(messages.at(-1).tool_call_id, 'html-call');
        yield new AIMessageChunk('已完成');
        return;
      }
      yield new AIMessageChunk({ content: '', tool_call_chunks: [{ id: 'html-call', name: 'export_html', index: 0, args: '{"title":"计划","html":"<h1>第一部分</h1>', type: 'tool_call_chunk' }] });
      await gate;
      yield new AIMessageChunk({ content: '', tool_call_chunks: [{ index: 0, args: '<p>后续内容</p>"}', type: 'tool_call_chunk' }] });
    },
  };
  const service = createAgentService({ checkpointer: new MemorySaver(), bootstrap: () => [], modelFactory: () => model, toolsFactory: () => createArtifactTools({ saveFile: file => {
    saved.push(file);
    return { fileId: randomUUID(), fileName: file.fileName, mimeType: file.mimeType, size: file.buffer.length, storageProvider: 'local' };
  } }) });
  const pending = service.runAgents({ input: '生成HTML', sessionId: 'live' }, { emit: event => {
    events.push(structuredClone(event));
    if (event.type === 'preview' && event.preview.content) received();
  } });
  await first;
  assert.equal(saved.length, 0);
  assert.ok(!events.some(event => event.type === 'artifact' || event.type === 'done'));
  assert.equal(events.find(event => event.type === 'preview').preview.status, 'generating');
  release();
  const result = await pending;
  assert.equal(result.artifacts[0].format, 'html');
  assert.equal(result.artifacts[0].toolCallId, 'html-call');
  assert.match(saved[0].buffer.toString(), /后续内容/);
  const artifactIndex = events.findIndex(event => event.type === 'artifact');
  const finalDraft = events.slice(0, artifactIndex).filter(event => event.type === 'preview').at(-1).preview;
  assert.equal(finalDraft.status, 'saving');
  assert.equal(finalDraft.toolCallId, 'html-call');
  assert.equal(finalDraft.content, saved[0].buffer.toString('utf8'));
  assert.match(finalDraft.content, /<!doctype html>/);
});

test('cancellation during a draft saves no file and failed export leaves a failed draft', async () => {
  const controller = new AbortController();
  let saved = false;
  const model = {
    bindTools() { return this; },
    async *stream(messages) {
      if (messages.at(-1)._getType() === 'tool') { yield new AIMessageChunk('需要修正参数'); return; }
      yield new AIMessageChunk({ content: '', tool_call_chunks: [{ id: 'bad', name: 'export_html', index: 0, args: '{"title":"空文档","html":""}', type: 'tool_call_chunk' }] });
    },
  };
  const service = createAgentService({ checkpointer: new MemorySaver(), bootstrap: () => [], modelFactory: () => model, toolsFactory: () => createArtifactTools({ saveFile() { saved = true; } }) });
  await assert.rejects(service.runAgents({ input: '取消', sessionId: 'cancel' }, { signal: controller.signal, emit: event => { if (event.type === 'preview') controller.abort(); } }));
  assert.equal(saved, false);
  const events = [];
  await service.runAgents({ input: '空文件', sessionId: 'failure' }, { emit: event => events.push(event) });
  assert.equal(saved, false);
  assert.ok(events.some(event => event.type === 'preview' && event.preview.status === 'failed'));
});

test('HTML exports UTF-8 and spreadsheet preview includes cached totals without losing zero', async () => {
  const html = await generateHtmlFile({ title: '网页.html', html: '<h1>你好</h1>' });
  assert.equal(html.fileName, '网页.html');
  assert.match(html.buffer.toString(), /charset="utf-8"/);
  const file = await generateSpreadsheetFile({ title: '预算', sheets: [{ name: '数据', columns: ['项目', '金额'], rows: [['甲', 1], ['乙', -1]], sumColumns: [2] }] });
  const data = JSON.parse(file.previewFile.buffer.toString());
  assert.deepEqual(data.sheets[0].rows.at(-1), ['合计', 0]);
  const blanks = await generateSpreadsheetFile({ title: '空值', sheets: [{ name: '空行', columns: ['甲', '乙'], rows: [[null, null], ['内容', null]], sumColumns: [] }] });
  assert.deepEqual(JSON.parse(blanks.previewFile.buffer.toString()).sheets[0].rows, [[null, null], ['内容', null]]);
});
