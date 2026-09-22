const { Router } = require('express');
const { getEnabledModels } = require('../config/models');

const { customModels } = require('../config/customModels');
const { timingSafeEqual } = require('node:crypto');
const { sendJsonError } = require('../utils/http');
const { t } = require('../i18n');
const router = Router();
router.use('/models/custom', (req, res, next) => {
  const expected = process.env.MODEL_CONFIG_TOKEN;
  const token = req.get('x-model-config-token') || '';
  if (!expected) return res.status(503).json({ msg: t('error.modelConfigDisabled') });
  if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.status(401).json({ msg: t('error.modelConfigAuth') });
  next();
});
router.post('/models/custom', (req, res) => {
  try { const id = customModels.upsert(req.body); res.json({ code: 200, data: { id } }); }
  catch (error) { if (error.name === 'ZodError') error = Object.assign(new Error(t('error.modelConfigInvalid')), { status: 400 }); sendJsonError(res, error); }
});
router.put('/models/custom/:id', (req, res) => {
  try { const id = customModels.upsert(req.body, req.params.id); res.json({ code: 200, data: { id } }); }
  catch (error) { if (error.name === 'ZodError') error = Object.assign(new Error(t('error.modelConfigInvalid')), { status: 400 }); sendJsonError(res, error); }
});
router.delete('/models/custom/:id', (req, res) => {
  try { customModels.remove(req.params.id); res.json({ code: 200 }); }
  catch (error) { sendJsonError(res, error); }
});

router.get('/models', (req, res) => {
  res.json({
    code: 200,
    data: getEnabledModels(),
    msg: 'ok',
  });
});

module.exports = router;
