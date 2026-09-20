function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isValidHttpStatusCode(status) {
  return Number.isInteger(status) && status >= 100 && status < 1000;
}

function getHttpStatusCode(error, fallback = 500) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
  ];

  for (const candidate of candidates) {
    if (isValidHttpStatusCode(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function sendJsonError(res, error, fallbackMessage) {
  const status = getHttpStatusCode(error, 500);

  return res.status(status).json({
    code: status,
    msg: error?.message || fallbackMessage || 'Server Error',
  });
}

function sendChatError(res, error) {
  const status = getHttpStatusCode(error, 500);
  const data = error.response?.data;

  if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
    return res.status(status).json(data);
  }
  if (typeof data === 'string') {
    return res.status(status).send(data);
  }

  return res.status(status).json({
    code: status,
    msg: error.message || 'Server Error',
  });
}

module.exports = {
  createHttpError,
  getHttpStatusCode,
  sendJsonError,
  sendChatError,
};
