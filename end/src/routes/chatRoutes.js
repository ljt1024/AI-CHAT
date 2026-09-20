const { Router } = require('express');
const { proxyChatCompletions } = require('../services/chatService');

const router = Router();

router.post('/chat/completions', async (req, res) => {
  await proxyChatCompletions(req, res);
});

router.post('/deepseek/chat', async (req, res) => {
  await proxyChatCompletions(req, res, 'deepseek-reasoner');
});

module.exports = router;
