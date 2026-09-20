const { randomUUID } = require('crypto');

function createRequestId() {
  return randomUUID();
}

function truncateText(value, maxLength = 2000) {
  const text = String(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...(truncated)`;
}

function safeSerialize(value) {
  if (value === undefined) {
    return undefined;
  }
  if (Buffer.isBuffer(value)) {
    return `[buffer ${value.length} bytes]`;
  }
  if (typeof value === 'string') {
    return truncateText(value);
  }

  try {
    return truncateText(JSON.stringify(value));
  } catch (error) {
    return truncateText(`[unserializable: ${error.message}]`);
  }
}

function writeLog(method, level, event, fields = {}) {
  const record = {
    level,
    time: new Date().toISOString(),
    event,
    ...fields,
  };

  method(JSON.stringify(record));
}

function logInfo(event, fields) {
  writeLog(console.log, 'info', event, fields);
}

function logError(event, fields) {
  writeLog(console.error, 'error', event, fields);
}

module.exports = {
  createRequestId,
  logInfo,
  logError,
  safeSerialize,
};
