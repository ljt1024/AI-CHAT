const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCustomModelStore } = require('../src/config/customModels');

test('custom model persistence, secret redaction, edit retention, removal and validation', t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'model-config-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file = path.join(dir,'models.json');const store = createCustomModelStore(file);
 const body = {name:'Vision test',modelId:'actual-model',baseUrl:'https://example.com/v1/',apiKey:'secret-test',supportsVision:true,supportsTools:true};
 const id=store.upsert(body);assert.equal(store.all()[0].supportsFileUpload,true);assert.ok(!JSON.stringify(store.all()).includes('secret-test'));
 assert.equal(store.provider(id).endpoint,'https://example.com/v1/chat/completions');
 store.upsert({...body,name:'Renamed',apiKey:''},id);assert.equal(store.provider(id).apiKey,'secret-test');
 assert.equal(createCustomModelStore(file).all()[0].name,'Renamed');assert.equal(fs.statSync(file).mode & 0o777,0o600);
 assert.throws(()=>store.upsert({...body,baseUrl:'file:///etc/passwd'}));
 assert.throws(()=>store.upsert({...body,apiKey:''}));
 store.remove(id);assert.deepEqual(store.all(),[]);
});

test('configuration HTTP requires management token and public catalog does not expose keys', async t => {
 const express = require('express');
 const router = require('../src/routes/modelRoutes');
 const old = process.env.MODEL_CONFIG_TOKEN;process.env.MODEL_CONFIG_TOKEN='test-admin-token';
 t.after(()=>{if(old===undefined)delete process.env.MODEL_CONFIG_TOKEN;else process.env.MODEL_CONFIG_TOKEN=old;});
 const server=express().use(express.json()).use('/api',router).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/models`;
 const denied=await fetch(base+'/custom',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,401);
 const invalid=await fetch(base+'/custom',{method:'POST',headers:{'Content-Type':'application/json','x-model-config-token':'test-admin-token'},body:'{}'});assert.equal(invalid.status,400);
 const models=await (await fetch(base)).json();assert.ok(models.data.every(item=>!('apiKey' in item)));
});
