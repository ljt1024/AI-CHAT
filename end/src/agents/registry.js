const agents = new Map([
  ['planner', { id: 'planner', name: '规划智能体', role: '拆解任务' }],
  ['researcher', { id: 'researcher', name: '研究智能体', role: '分析信息' }],
  ['writer', { id: 'writer', name: '写作智能体', role: '整合输出' }],
]);

function listAgents() { return [...agents.values()]; }
function getAgent(id) { return agents.get(id); }

module.exports = { listAgents, getAgent };
