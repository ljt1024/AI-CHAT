const { t, getLanguage } = require('../i18n');
const { tool } = require('@langchain/core/tools');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const { getAgent } = require('./registry');
const { createArtifactTools } = require('./artifactTools');
const { getWeather, weatherSchema } = require('../services/weatherService');

function createAgentTools(model, agentIds) {
  return [
    tool(({ operation, values }) => {
      let result;
      switch (operation) {
        case 'add': result = values.reduce((a, b) => a + b); break;
        case 'subtract': result = values.reduce((a, b) => a - b); break;
        case 'multiply': result = values.reduce((a, b) => a * b); break;
        case 'divide':
          if (values.slice(1).includes(0)) throw new Error(t('calculator.zero'));
          result = values.reduce((a, b) => a / b); break;
      }
      if (!Number.isFinite(result)) throw new Error(t('calculator.overflow'));
      return JSON.stringify({ result });
    }, {
      name: 'calculate', description: t('tool.calculate'),
      schema: z.object({ operation: z.enum(['add', 'subtract', 'multiply', 'divide']), values: z.array(z.number()).min(2).max(100) }),
    }),
    tool(() => new Date().toISOString(), {
      name: 'current_time', description: t('tool.time'), schema: z.object({}),
    }),
    tool((args, config) => getWeather(args, config), {
      name: 'get_weather', description: t('tool.weather'), schema: weatherSchema,
    }),
    ...createArtifactTools().filter(item => item.name !== 'generate_image'),
    ...agentIds.map((id) => {
      const agent = getAgent(id);
      return tool(async ({ task }, config) => {
        let result;
        for await (const chunk of await model.stream([
          new SystemMessage(t('agent.delegatePrompt', { p0: agent.name, p1: agent.role }) + ` Default response language: ${getLanguage() === 'en' ? 'English' : 'Chinese'}. Follow the task's explicit language requirements.`),
          new HumanMessage(task),
        ], { signal: config?.signal })) {
          config?.signal?.throwIfAborted();
          result = result ? result.concat(chunk) : chunk;
          const text = messageText(chunk);
          if (text) config?.configurable?.onToolDelta?.(text);
        }
        if (!result || !messageText(result).trim()) throw new Error(t('agent.delegateEmpty'));
        if (result.response_metadata?.finish_reason === 'length') throw new Error(t('agent.delegateTruncated'));
        return messageText(result);
      }, {
        name: `delegate_${id}`,
        description: t('tool.delegate', { p0: agent.name, p1: agent.role }),
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
