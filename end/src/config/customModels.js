const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { env } = require('./env');
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  modelId: z.string().trim().min(1).max(160),
  baseUrl: z.string().url().max(500).refine(value => {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  }),
  apiKey: z.string().trim().max(4096).optional(),
  supportsVision: z.boolean().default(false),
  supportsTools: z.boolean().default(false),
});
function createCustomModelStore(filename = path.join(env.paths.localStorageDir, 'custom-models.json')) {
  let entries = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : [];
  function save(next) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(next), { mode: 0o600 });
    fs.renameSync(`${filename}.tmp`, filename);
    fs.chmodSync(filename, 0o600);
    entries = next;
  }
  return {
    all: () => entries.map(({ apiKey, ...item }) => ({ ...item, hasApiKey: Boolean(apiKey), custom: true, provider: 'custom', supportsStream: true, supportsThinking: false, supportsFileUpload: item.supportsVision, enabled: Boolean(apiKey) })),
    provider: id => { const item = entries.find(item => item.id === id); return item && { apiKey: item.apiKey, endpoint: `${item.baseUrl}/chat/completions` }; },
    upsert(body, id) {
      const data = schema.parse(body);
      const previous = entries.find(item => item.id === id);
      if (id && !previous) throw Object.assign(new Error('Model not found'), { status: 404 });
      const apiKey = data.apiKey || previous?.apiKey;
      if (!apiKey) throw Object.assign(new Error('API Key is required'), { status: 400 });
      const item = { ...data, baseUrl: data.baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, ''), apiKey, id: id || `custom-${randomUUID()}` };
      save([...entries.filter(old => old.id !== item.id), item]);
      return item.id;
    },
    remove(id) {
      if (!entries.some(item => item.id === id)) throw Object.assign(new Error('Model not found'), { status: 404 });
      save(entries.filter(item => item.id !== id));
    },
  };
}
const customModels = createCustomModelStore();
module.exports = { customModels, createCustomModelStore };
