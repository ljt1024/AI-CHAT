const { tool } = require('@langchain/core/tools');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const { getAgent } = require('./registry');

function createAgentTools(model, agentIds) {
  return [
    tool(({ operation, values }) => {
      let result;
      switch (operation) {
        case 'add': result = values.reduce((a, b) => a + b); break;
        case 'subtract': result = values.reduce((a, b) => a - b); break;
        case 'multiply': result = values.reduce((a, b) => a * b); break;
        case 'divide':
          if (values.slice(1).includes(0)) throw new Error('除数不能为零');
          result = values.reduce((a, b) => a / b); break;
      }
      if (!Number.isFinite(result)) throw new Error('结果超出数值范围');
      return JSON.stringify({ result });
    }, {
      name: 'calculate', description: '对数值执行加、减、乘、除，获取可验证的计算结果。',
      schema: z.object({ operation: z.enum(['add', 'subtract', 'multiply', 'divide']), values: z.array(z.number()).min(2).max(100) }),
    }),
    tool(() => new Date().toISOString(), {
      name: 'current_time', description: '获取当前 UTC 时间。', schema: z.object({}),
    }),
    ...agentIds.map((id) => {
      const agent = getAgent(id);
      return tool(async ({ task }, config) => {
        let result;
        for await (const chunk of await model.stream([
          new SystemMessage(`你是${agent.name}，负责${agent.role}。完成主智能体委派的具体任务，输出结论、依据与不确定性。你没有联网检索或执行代码的能力，不要声称做过这些操作。`),
          new HumanMessage(task),
        ], { signal: config?.signal })) {
          config?.signal?.throwIfAborted();
          result = result ? result.concat(chunk) : chunk;
          const text = messageText(chunk);
          if (text) config?.configurable?.onToolDelta?.(text);
        }
        if (!result || !messageText(result).trim()) throw new Error('子智能体返回了空内容');
        if (result.response_metadata?.finish_reason === 'length') throw new Error('子智能体输出被上游截断，请缩小委派任务后重试');
        return messageText(result);
      }, {
        name: `delegate_${id}`,
        description: `委派给${agent.name}，负责${agent.role}。传入具体任务及必要上下文。`,
        schema: z.object({ task: z.string().min(1).max(30000) }),
      });
    }),
  ];
}
function messageText(message) {
  if (typeof message.content === 'string') return message.content;
  return (message.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('');
}
module.exports = { createAgentTools, messageText };
