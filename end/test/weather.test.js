const test = require('node:test');
const assert = require('node:assert/strict');
const { getWeather } = require('../src/services/weatherService');
const { createAgentTools } = require('../src/agents/tools');
test('weather resolves city, sends adcode, preserves units and source', async () => {
 const calls = [];
 const result = JSON.parse(await getWeather({city:'北京'}, {apiKey:'test', http:{get:async(url, options)=>{
 calls.push(options.params);
 return {data: calls.length === 1 ? {status:'1',geocodes:[{adcode:'110100'}]} : {status:'1',lives:[{city:'北京市',temperature:'0',reporttime:'2026-09-21 10:00:00'}]}};
 }}}));
 assert.equal(calls[1].city,'110100');assert.equal(calls[1].extensions,'base');assert.equal(result.temperatureC,'0');assert.equal(result.source,'高德地图天气');
 assert.ok(createAgentTools({},[]).some(tool=>tool.name==='get_weather'));
});
test('weather forecast retains provider timestamp', async()=>{
 let n=0;
 const result=JSON.parse(await getWeather({city:'北京',forecast:true},{apiKey:'test',http:{get:async()=>({data:++n===1?{status:'1',geocodes:[{adcode:'110100'}]}:{status:'1',forecasts:[{city:'北京',reporttime:'timestamp',casts:[{date:'2026-09-21',daytemp:'20'}]}]}})}}));
 assert.equal(result.reportTime,'timestamp');assert.equal(result.forecasts[0].dayTemperatureC,'20');
});
test('weather rejects missing key, cancellation, auth errors, unknown cities and empty results', async()=>{
 await assert.rejects(getWeather({city:'北京'},{apiKey:''}),{status:503});
 const controller=new AbortController();controller.abort();
 await assert.rejects(getWeather({city:'北京'},{signal:controller.signal,apiKey:'test'}),{name:'AbortError'});
 for(const [data,status] of [[{status:'0',infocode:'10001'},502],[{status:'1',geocodes:[]},404]]) {
 await assert.rejects(getWeather({city:'北京'},{apiKey:'test',http:{get:async()=>({data})}}),{status});
 }
 let n=0;
 await assert.rejects(getWeather({city:'北京'},{apiKey:'test',http:{get:async()=>({data:++n===1?{status:'1',geocodes:[{adcode:'110100'}]}:{status:'1',lives:[]}})}}),{status:502});
});
