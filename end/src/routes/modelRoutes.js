const { Router } = require('express');
const { getEnabledModels } = require('../config/models');

const router = Router();

router.get('/models', (req, res) => {
  res.json({
    code: 200,
    data: getEnabledModels(),
    msg: 'ok',
  });
});

module.exports = router;
