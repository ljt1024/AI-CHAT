const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const apiRoutes = require('./routes');
const { getHttpStatusCode } = require('./utils/http');
const { createRequestId, logError, logInfo } = require('./utils/logger');

const { languageMiddleware } = require('./i18n');
const app = express();
app.use(languageMiddleware);

app.use(cors());
app.use((req, res, next) => {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = typeof requestIdHeader === 'string' && requestIdHeader.trim()
    ? requestIdHeader.trim()
    : createRequestId();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  logInfo('request.start', {
    requestId,
    method: req.method,
    path: req.originalUrl,
  });

  res.on('finish', () => {
    logInfo('request.finish', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});
app.use(express.json({
  limit: env.maxUploadFileSizeBytes,
}));
app.use('/api', apiRoutes);
app.use((error, req, res, next) => {
  const status = getHttpStatusCode(error);

  logError('request.unhandled_error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    message: error.message,
  });

  if (res.headersSent) {
    return next(error);
  }

  return res.status(status).json({
    code: status,
    msg: error.message || 'Server Error',
    requestId: req.requestId,
  });
});

module.exports = app;
