const { t } = require('../i18n');
const { Router } = require('express');
const { createShare, getSharedMessage } = require('../services/shareService');

const router = Router();

router.post('/chat/shareMsg', (req, res) => {
  try {
    const data = getSharedMessage(req.body?.id);
    res.json({
      code: 200,
      data,
      msg: data ? 'ok' : t('error.shareMissing'),
    });
  } catch (error) {
    res.json({ code: 500, msg: error.message || error });
  }
});

router.post('/chat/shareCreate', (req, res) => {
  try {
    createShare(req.body);
    res.json({ code: 200, msg: 'ok' });
  } catch (error) {
    res.json({ code: 500, msg: error.message || error });
  }
});

module.exports = router;
