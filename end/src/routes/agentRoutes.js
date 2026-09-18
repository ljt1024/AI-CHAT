const { Router } = require('express');
const { listAgents } = require('../agents/registry');
const { runAgents } = require('../services/agentService');
const { getHttpStatusCode } = require('../utils/http');
const { logError } = require('../utils/logger');

function createAgentRouter(run = runAgents) {
  const router = Router();
  router.get('/agents', (req, res) => res.json({ code: 200, data: listAgents(), msg: 'ok' }));
  router.post('/agents/run', async (req, res) => {
    const stream = req.body?.stream === true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('执行超时，请缩小任务范围后重试')), 300000);
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', onClose);
    let heartbeat;
    const send = (event) => {
      if (res.destroyed || res.writableEnded) return;
      if (!res.headersSent) {
        res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        heartbeat = setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); }, 15000);
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      const data = await run(req.body, { signal: controller.signal, emit: stream ? send : undefined });
      if (res.destroyed) return;
      if (stream) res.end();
      else res.json({ code: 200, data, msg: 'ok' });
    } catch (error) {
      if (res.destroyed) return;
      const status = controller.signal.aborted ? 504 : getHttpStatusCode(error, 502);
      const msg = controller.signal.aborted ? '执行已停止或超时，请重试' : error.message || '智能体执行失败';
      logError('agents.run.failed', { requestId: req.requestId, status, message: msg });
      if (res.headersSent) { send({ type: 'error', message: msg, requestId: req.requestId }); res.end(); }
      else res.status(status).json({ code: status, msg, requestId: req.requestId });
    } finally {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      res.off('close', onClose);
    }
  });
  return router;
}
module.exports = createAgentRouter();
module.exports.createAgentRouter = createAgentRouter;
