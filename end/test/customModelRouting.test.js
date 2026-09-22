const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { env } = require('../src/config/env');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-routing-'));
env.paths.localStorageDir = dir;
const { customModels } = require('../src/config/customModels');
const { createChatModel } = require('../src/models/chatModel');

test('LangChain sends configured model ID and key to the configured endpoint', async t => {
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const received=[];
 const server=http.createServer(async(req,res)=>{
 let body='';for await(const chunk of req)body+=chunk;
 received.push({url:req.url,authorization:req.headers.authorization,body:JSON.parse(body)});
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'test',object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:'connected'},finish_reason:'stop'}]}));
 }).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
 const id=customModels.upsert({name:'Route test',modelId:'provider-model',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,apiKey:'routing-secret',supportsTools:true});
 const result=await createChatModel(id).invoke('hello');
 assert.equal(result.content,'connected');assert.equal(received[0].url,'/v1/chat/completions');assert.equal(received[0].body.model,'provider-model');assert.equal(received[0].authorization,'Bearer routing-secret');
 customModels.remove(id);
});
