const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { MemorySaver } = require('@langchain/langgraph');
const { AIMessageChunk } = require('@langchain/core/messages');
const { t, withLanguage, negotiateLanguage } = require('../src/i18n');
const { createAgentRouter } = require('../src/routes/agentRoutes');
const { createAgentService } = require('../src/services/agentService');
const { listAgents } = require('../src/agents/registry');
const { getEnabledModels } = require('../src/config/models');
const { generateSpreadsheetFile, spreadsheetSchema } = require('../src/services/spreadsheetService');

test('language negotiation and concurrent async contexts remain isolated', async () => {
  assert.equal(negotiateLanguage('fr, en-US;q=0.8, zh-CN;q=0.5'), 'en');
  assert.equal(negotiateLanguage('en;q=0, zh-TW;q=1'), 'zh');
  assert.equal(negotiateLanguage('de'), 'zh');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const english = withLanguage('en', async () => {
    await gate;
    assert.equal(t('error.inputRequired'), 'input is required');
    assert.equal(listAgents()[0].name, 'Planner');
    assert.equal(getEnabledModels()[0].description, 'DeepSeek general conversation model');
  });
  await withLanguage('zh', async () => {
    release();
    await english;
    assert.equal(t('error.inputRequired'), 'input 不能为空');
    assert.equal(listAgents()[0].name, '规划智能体');
  });
});

test('HTTP validation and SSE progress use the requested language; model text is preserved', async (context) => {
  const service = createAgentService({ checkpointer: new MemorySaver(), bootstrap: () => [], toolsFactory: () => [], modelFactory: () => ({
    bindTools() { return this; },
    async *stream(messages) {
      assert.match(messages[0].content, /Default response language: English/);
      yield new AIMessageChunk('用户指定的中文内容');
    },
  }) });
  const app = express(); app.use(express.json()); app.use('/api', createAgentRouter(service.runAgents));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); context.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/agents/run`;
  const bad = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en-US' }, body: '{}' });
  assert.equal(bad.status, 400); assert.equal(bad.headers.get('content-language'), 'en'); assert.equal((await bad.json()).msg, 'input is required');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en-US' }, body: JSON.stringify({ input: '保留中文', sessionId: 'i18n', stream: true }) });
  const events = (await response.text()).split('\n\n').filter(block => block.startsWith('data: ')).map(block => JSON.parse(block.slice(6)));
  assert.ok(events.some(e => e.type === 'step' && e.step.output === 'Analyzing the task with 0 conversation memory messages.'));
  assert.ok(events.some(e => e.type === 'step' && e.step.outputTranslation?.key === 'server.agent.analyzing'));
  assert.equal(events.at(-1).result.output, '用户指定的中文内容');
  assert.equal(events.at(-1).result.steps.at(-1).outputTranslation, undefined);
});

test('spreadsheet totals and schema errors use the active request language', async () => {
  await withLanguage('en', async () => {
    const input = { title: 'Test', sheets: [{ name: 'Sheet', columns: ['Name', 'Value'], rows: [['A', 1]], sumColumns: [2] }] };
    const file = await generateSpreadsheetFile(input);
    assert.equal(JSON.parse(file.previewFile.buffer.toString()).sheets[0].rows.at(-1)[0], 'Total');
    input.sheets[0].name = "'invalid";
    const result = spreadsheetSchema.safeParse(input);
    assert.equal(result.success, false);
    assert.match(result.error.message, /cannot begin or end/);
  });
});
