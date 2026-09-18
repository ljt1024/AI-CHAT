const fs = require('node:fs');
const path = require('node:path');
const { SqliteSaver } = require('@langchain/langgraph-checkpoint-sqlite');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { env } = require('../config/env');

function createMemoryStore(filename = path.join(env.paths.localStorageDir, 'agent-checkpoints.sqlite')) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const saver = SqliteSaver.fromConnString(filename);
  saver.setup();
  return saver;
}
// One-time bootstrap for conversations written by the old implementation.
// The shared 'default' bucket is intentionally excluded: its owner is unknown.
function legacyHistory(sessionId) {
  if (sessionId === 'default') return [];
  const filename = path.join(env.paths.localStorageDir, 'agent-memory.json');
  if (!fs.existsSync(filename)) return [];
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const messages = Object.hasOwn(data, sessionId) ? data[sessionId] : [];
  if (!Array.isArray(messages)) return [];
  return messages.filter((m) => typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
    .map((m) => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));
}
module.exports = { createMemoryStore, legacyHistory };
