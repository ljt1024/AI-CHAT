const { Router } = require('express');
const modelRoutes = require('./modelRoutes');
const fileRoutes = require('./fileRoutes');
const chatRoutes = require('./chatRoutes');
const shareRoutes = require('./shareRoutes');
const agentRoutes = require('./agentRoutes');

const router = Router();

router.get('/', (req, res) => res.json({ code: 200, msg: 'AI-Server is running' }));

router.use(modelRoutes);
router.use(fileRoutes);
router.use(chatRoutes);
router.use(shareRoutes);
router.use(agentRoutes);

module.exports = router;
