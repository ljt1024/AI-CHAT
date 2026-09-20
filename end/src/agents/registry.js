const { t } = require('../i18n');
const agents = new Map([
  ['planner', { id: 'planner', get name() { return t('planner.name'); }, get role() { return t('planner.role'); } }],
  ['researcher', { id: 'researcher', get name() { return t('researcher.name'); }, get role() { return t('researcher.role'); } }],
  ['writer', { id: 'writer', get name() { return t('writer.name'); }, get role() { return t('writer.role'); } }],
]);

function listAgents() { return [...agents.values()]; }
function getAgent(id) { return agents.get(id); }

module.exports = { listAgents, getAgent };
