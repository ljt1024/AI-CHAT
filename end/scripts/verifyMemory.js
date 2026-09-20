// Opt-in live model check: node end/scripts/verifyMemory.js [deepseek-chat]
// Uses a temporary SQLite database; does not change existing conversations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { createMemoryStore } = require('../src/agents/memoryStore');
const { createAgentService } = require('../src/services/agentService');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-live-memory-'));
  const file = path.join(dir, 'memory.sqlite');
  let checkpointer = createMemoryStore(file);
  try {
    const code = `银杏-${randomUUID().slice(0, 8)}`;
    const history = [];
    for (let i = 0; i < 6; i++) {
      history.push(new HumanMessage(i === 0
        ? `我的测试代号是${code}，请记住。以下是无关的重复日志：${'当天环境检查正常。'.repeat(3200)}`
        : `第${i}次环境检查完成。`));
      history.push(new AIMessage('已记录。'));
    }
    let service = createAgentService({ checkpointer, bootstrap: () => history });
    const request = { input: '我之前的测试代号是什么？仅回答完整代号。', sessionId: 'live-summary', model: process.argv[2] || 'deepseek-chat', turnId: 'recall' };
    const events = [];
    const result = await service.runAgents(request, {
      signal: AbortSignal.timeout(240000), emit: (event) => {
        events.push(event);
        if (event.type === 'step') console.log(event.step.phase, event.step.status, event.step.output);
      },
    });
    assert.ok(result.output.includes(code), result.output);
    assert.equal(result.memoryMessages, 14);
    assert.ok(events.some((event) => event.type === 'memory' && event.summarizedMessages === 4 && event.recentMessages === 8));
    console.log('PASS: real model recalls old fact through batched summary');
    checkpointer.db.close();
    checkpointer = createMemoryStore(file);
    service = createAgentService({ checkpointer, bootstrap: () => [] });
    const retried = await service.runAgents(request, { signal: AbortSignal.timeout(120000) });
    assert.ok(retried.output.includes(code), retried.output);
    assert.equal(retried.memoryMessages, 14);
    console.log('PASS: SQLite reopen and regeneration preserve memory without duplicate turns');
  } finally {
    checkpointer.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
