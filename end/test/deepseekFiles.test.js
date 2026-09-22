const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { env } = require('../src/config/env');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-files-'));
env.paths.localStorageDir = dir;
env.paths.localUploadDir = path.join(dir, 'uploads');
env.paths.localFileIndexPath = path.join(dir, 'files.json');
const { uploadDeepseekFile, resolveDeepseekFiles } = require('../src/services/deepseekFileService');
const { saveLocalFile } = require('../src/services/fileService');
const { MODEL_INDEX } = require('../src/config/models');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
test.after(() => fs.rmSync(dir, {recursive:true,force:true}));

test('DeepSeek multipart purpose, binary content, provider ID and cancellation', async () => {
 const file = {buffer:png,fileName:'test.png'};
 const id=await uploadDeepseekFile(file,{apiKey:'secret',http:{post:async(url,form,config)=>{
  assert.equal(url,'https://api.deepseek.com/files');assert.equal(form.get('purpose'),'user_data');assert.deepEqual(Buffer.from(await form.get('file').arrayBuffer()),png);assert.equal(config.headers.Authorization,'Bearer secret');return {data:{id:'file-api-test'}};
 }}});
 assert.equal(id,'file-api-test');
 await assert.rejects(uploadDeepseekFile({buffer:Buffer.from('%PDF-'),fileName:'fake.png'},{apiKey:'secret'}),{status:400});
 const controller=new AbortController();controller.abort();await assert.rejects(uploadDeepseekFile(file,{signal:controller.signal}),{name:'AbortError'});
 await assert.rejects(uploadDeepseekFile(file,{apiKey:'secret',http:{post:async()=>({data:{id:'bad'}})}}),{status:502});
});

test('provider references are persisted and unsupported models cannot consume them', () => {
 const file=saveLocalFile({fileName:'test.png',mimeType:'image/png',buffer:png,provider:'deepseek',providerFileId:'file-api-test'});
 assert.deepEqual(resolveDeepseekFiles([file.fileId],MODEL_INDEX.get('deepseek-flash')),[{type:'file',file_id:'file-api-test'}]);
 assert.throws(()=>resolveDeepseekFiles([file.fileId],MODEL_INDEX.get('deepseek-chat')),{status:400});
 assert.throws(()=>resolveDeepseekFiles(['file-api-test'],MODEL_INDEX.get('deepseek-flash')),{status:400});
});

test('LangGraph keeps image references for follow-up and supports regeneration', async t => {
 const { AIMessageChunk }=require('@langchain/core/messages');
 const { createAgentService }=require('../src/services/agentService');
 const { createMemoryStore }=require('../src/agents/memoryStore');
 const saver=createMemoryStore(path.join(dir,'memory.sqlite'));t.after(()=>saver.db.close());
 const seen=[];const model={bindTools(){return this},async *stream(messages){seen.push(messages);yield new AIMessageChunk('A green circle.');}};
 const service=createAgentService({checkpointer:saver,modelFactory:()=>model,toolsFactory:()=>[],bootstrap:()=>[]});
 const file=saveLocalFile({fileName:'test.png',mimeType:'image/png',buffer:png,provider:'deepseek',providerFileId:'file-api-test'});
 const body={input:'What is in the image?',model:'deepseek-flash',sessionId:'vision-test',turnId:'first',fileIds:[file.fileId]};
 await service.runAgents(body);await service.runAgents(body);
 await service.runAgents({input:'What color?',model:'deepseek-flash',sessionId:'vision-test',turnId:'second'});
 assert.ok(seen.at(-1).some(message=>Array.isArray(message.content)&&message.content.some(part=>part.file_id==='file-api-test')));
 assert.equal(seen.at(-1).filter(message=>message.id==='first').length,1);
});
