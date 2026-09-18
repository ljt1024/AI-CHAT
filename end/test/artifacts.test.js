const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ExcelJS = require('exceljs');
const { AIMessageChunk } = require('@langchain/core/messages');
const { generateDocumentFile } = require('../src/services/documentService');
const { generateSpreadsheetFile } = require('../src/services/spreadsheetService');
const { createArtifactTools } = require('../src/agents/artifactTools');
const { createAgentService } = require('../src/services/agentService');
const { createMemoryStore } = require('../src/agents/memoryStore');

const workbookInput = { title: '项目预算', sheets: [{ name: '预算', columns: ['项目', '金额（元）'], rows: [['设计', 1200], ['开发', 3400], ['=1+1', -200], ['空值', null]], sumColumns: [2] }] };

test('Excel export preserves data types and literal strings, with valid cached SUM formulas', async () => {
  const file = await generateSpreadsheetFile(workbookInput);
  assert.equal(file.fileName, '项目预算.xlsx');
  assert.equal(file.buffer.subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const sheet = workbook.getWorksheet('预算');
  assert.equal(sheet.getCell('A4').value, '=1+1');
  assert.equal(sheet.getCell('A4').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('B2').value, 1200);
  assert.deepEqual(sheet.getCell('B6').value, { formula: 'SUM(B2:B5)', result: 4400 });
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.getCell('A1').font.name, 'Arial');
  const zero = await generateSpreadsheetFile({ title: '零值', sheets: [{ name: '数据', columns: ['数值'], rows: [[1], [-1], [null]], sumColumns: [1] }] });
  const zeroBook = new ExcelJS.Workbook();
  await zeroBook.xlsx.load(zero.buffer);
  assert.equal(zeroBook.getWorksheet('数据').getCell('A5').formula, 'SUM(A2:A4)');
  assert.equal(zeroBook.getWorksheet('数据').getCell('A5').result, 0);
});

test('export validation rejects inconsistent rows, duplicate sheets and invalid totals before saving', async () => {
  for (const sheets of [
    [{ name: 'a', columns: ['x'], rows: [['x', 'y']] }],
    [{ name: '../bad', columns: ['x'], rows: [[1]] }],
    [{ name: 'a', columns: ['x'], rows: [['text']], sumColumns: [1] }],
    [{ name: 'a', columns: ['x'], rows: [[1]] }, { name: 'A', columns: ['x'], rows: [[2]] }],
  ]) await assert.rejects(generateSpreadsheetFile({ title: '无效', sheets }));
  const controller = new AbortController();
  controller.abort();
  let saved = false;
  const tool = createArtifactTools({ saveFile: () => { saved = true; } }).find((item) => item.name === 'export_excel');
  await assert.rejects(tool.invoke(workbookInput, { signal: controller.signal }));
  assert.equal(saved, false);
});

test('PDF generation produces an embedded-font PDF without platform commands', async () => {
  const file = await generateDocumentFile({ format: 'pdf', title: '中文导出测试', content: '# 项目计划\n第一阶段：需求整理。\n\n第二阶段：开发与验证。' });
  assert.equal(file.buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(file.buffer.includes(Buffer.from('/FontFile')));
  assert.equal(file.fileName, '中文导出测试.pdf');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(generateDocumentFile({ format: 'pdf', content: '测试' }, '', { signal: controller.signal }), { name: 'AbortError' });
});

test('agent emits downloadable artifacts before done and retains links in next-turn memory', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-agent-'));
  const saver = createMemoryStore(path.join(dir, 'memory.sqlite'));
  t.after(() => { saver.db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  let create = true;
  const seen = [];
  const model = {
    bindTools() { return this; },
    async *stream(messages) {
      seen.push(messages);
      if (create && messages.at(-1)._getType() !== 'tool') yield new AIMessageChunk({ content: '', tool_calls: [{ id: 'file-call', name: 'export_excel', args: workbookInput, type: 'tool_call' }] });
      else yield new AIMessageChunk('文件已生成，请下载。');
    },
  };
  const saved = [];
  const service = createAgentService({ checkpointer: saver, modelFactory: () => model, bootstrap: () => [], toolsFactory: () => createArtifactTools({ saveFile: (file) => {
    const fileId = randomUUID();
    fs.writeFileSync(path.join(dir, `${fileId}.xlsx`), file.buffer);
    saved.push(fileId);
    return { fileId, fileName: file.fileName, size: file.buffer.length, mimeType: file.mimeType, storageProvider: 'local' };
  } }) });
  const events = [];
  const result = await service.runAgents({ input: '生成预算Excel', sessionId: 'files' }, { emit: (event) => events.push(structuredClone(event)) });
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0].fileId, saved[0]);
  const downloadPath = `/api/files/${saved[0]}/download`;
  assert.equal(result.artifacts[0].downloadPath, downloadPath);
  assert.ok(events.findIndex((event) => event.type === 'artifact') < events.findIndex((event) => event.type === 'done'));
  create = false;
  const next = await service.runAgents({ input: '刚才的文件在哪', sessionId: 'files' });
  assert.ok(seen.at(-1).some((message) => message.content.includes(downloadPath)));
  assert.deepEqual(next.artifacts, []);
});

const { generatePresentationFile } = require('../src/services/presentationService');
const JSZip = require('jszip');
const presentationInput = { title: '项目计划', slides: [
  { title: '项目目标', body: ['支持 PDF 与 PowerPoint 导出', '生成后立即打开右侧预览'] },
  { title: '验收方案', body: ['验证下载文件可打开', '验证刷新后重新预览'] },
] };

test('PowerPoint contains editable slide text and a matching embedded-font PDF preview', async () => {
  const file = await generatePresentationFile(presentationInput);
  const zip = await JSZip.loadAsync(file.buffer);
  const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideFiles.length, 2);
  assert.equal(file.pageCount, 2);
  for (let i = 0; i < 2; i++) {
    const xml = await zip.file(`ppt/slides/slide${i + 1}.xml`).async('string');
    assert.ok(xml.includes(presentationInput.slides[i].title));
    for (const line of presentationInput.slides[i].body) assert.ok(xml.includes(line));
  }
  assert.equal(file.previewFile.buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(file.previewFile.buffer.includes(Buffer.from('/FontFile')));
});

test('PowerPoint validation rejects excess content instead of silently truncating', async () => {
  await assert.rejects(generatePresentationFile({ ...presentationInput, slides: [] }));
  await assert.rejects(generatePresentationFile({ ...presentationInput, slides: [{ title: '长文本', body: ['内容'.repeat(60)] }] }));
  await assert.rejects(generatePresentationFile({ ...presentationInput, slides: [{ title: '多换行', body: ['一\n'.repeat(40)] }] }), /正文过长/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(generatePresentationFile(presentationInput, { signal: controller.signal }), { name: 'AbortError' });
});

test('PowerPoint tool emits only the finished artifact and persists a downloadable preview reference', async () => {
  const saved = [];
  const events = [];
  const tool = createArtifactTools({ saveFile(file) {
    const meta = { fileId: randomUUID(), fileName: file.fileName, mimeType: file.mimeType, size: file.buffer.length, storageProvider: 'local' };
    saved.push(meta);
    return meta;
  } }).find(item => item.name === 'export_pptx');
  const result = JSON.parse(await tool.invoke(presentationInput, { configurable: { onArtifact: artifact => events.push(artifact) } }));
  assert.equal(saved.length, 2);
  assert.equal(events.length, 1);
  assert.equal(result.fileId, saved[1].fileId);
  assert.equal(result.previewFileId, saved[0].fileId);
  assert.equal(result.pageCount, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(events[0])).previewFileId, saved[0].fileId);
});
