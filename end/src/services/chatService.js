const axios = require('axios');
const { env } = require('../config/env');
const { MODEL_CATALOG, MODEL_INDEX, PROVIDER_CONFIG } = require('../config/models');
const { createHttpError, getHttpStatusCode, sendChatError, sendJsonError } = require('../utils/http');
const { logError, logInfo, safeSerialize } = require('../utils/logger');
const { extractAssistantText, generateDocumentFile } = require('./documentService');
const {
  buildFileAccessPayload,
  deleteUploadedFilesByIds,
  normalizeFilesFromIds,
  saveLocalFile,
} = require('./fileService');
const { isImageLikeFile } = require('../utils/upload');

function normalizeInlineFiles(files) {
  if (!Array.isArray(files)) {
    throw createHttpError(400, 'files 必须为数组');
  }

  return files.map((rawFile, index) => {
    if (!rawFile || typeof rawFile !== 'object') {
      throw createHttpError(400, `files[${index}] 格式无效`);
    }

    const name = typeof rawFile.name === 'string' && rawFile.name.trim()
      ? rawFile.name.trim()
      : `file_${index + 1}`;
    const type = typeof rawFile.type === 'string' && rawFile.type.trim()
      ? rawFile.type.trim()
      : 'unknown';
    const url = typeof rawFile.url === 'string' ? rawFile.url.trim() : '';
    const content = typeof rawFile.content === 'string'
      ? rawFile.content
      : (typeof rawFile.text === 'string' ? rawFile.text : '');

    if (!url && !content) {
      throw createHttpError(400, `files[${index}] 至少需要提供 url 或 content/text`);
    }

    return {
      name,
      type,
      url,
      content,
      note: '',
      fileId: '',
      isImage: isImageLikeFile(name, type) && Boolean(url),
    };
  });
}

function supportsVisionMessages(modelConfig) {
  return Boolean(modelConfig.supportsVision);
}

function createImageContentPart(url) {
  return {
    type: 'image_url',
    image_url: {
      url,
    },
  };
}

function createTextContentPart(text) {
  return {
    type: 'text',
    text,
  };
}

function normalizeMessageContentParts(content) {
  if (Array.isArray(content)) {
    return [...content];
  }
  if (typeof content === 'string' && content.trim()) {
    return [createTextContentPart(content)];
  }
  return [];
}

function injectImageFilesIntoMessages(messages, imageFiles) {
  if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
    return messages;
  }

  const nextMessages = messages.map((message) => ({ ...message }));
  const imageParts = imageFiles.map((file) => createImageContentPart(file.url));
  let targetIndex = -1;

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    if (nextMessages[index]?.role === 'user') {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex === -1) {
    nextMessages.push({
      role: 'user',
      content: imageParts,
    });
    return nextMessages;
  }

  const targetMessage = nextMessages[targetIndex];
  const existingParts = normalizeMessageContentParts(targetMessage.content);
  nextMessages[targetIndex] = {
    ...targetMessage,
    content: [...imageParts, ...existingParts],
  };

  return nextMessages;
}

function buildNonImageFilePrompt(files) {
  const lines = [
    `用户上传了 ${files.length} 个文件，请结合文件内容回答问题。`,
    '如果文件信息不足，请明确说明。',
  ];

  files.forEach((file, index) => {
    lines.push(`文件 ${index + 1}: ${file.name}`);
    lines.push(`类型: ${file.type}`);
    if (file.fileId) {
      lines.push(`文件ID: ${file.fileId}`);
    }
    if (file.url) {
      lines.push(`地址: ${file.url}`);
    }
    if (file.content) {
      lines.push('文件内容:');
      lines.push(file.content);
      if (file.content.length > env.maxFileContentLength) {
        lines.push(`(内容已截断，原始长度 ${file.content.length} 字符)`);
      }
    }
    if (file.note) {
      lines.push(`备注: ${file.note}`);
    }
  });

  return lines.join('\n');
}

function normalizeThinkingValue(rawThinking, modelConfig) {
  if (rawThinking === undefined || !modelConfig.supportsThinking) {
    return undefined;
  }

  if (modelConfig.provider === 'qwen') {
    return rawThinking;
  }

  if (modelConfig.provider === 'deepseek') {
    if (typeof rawThinking === 'boolean') {
      return {
        type: rawThinking ? 'enabled' : 'disabled',
      };
    }

    if (typeof rawThinking === 'string') {
      const type = rawThinking.trim().toLowerCase();
      if (type === 'enabled' || type === 'disabled') {
        return { type };
      }
    }

    if (rawThinking && typeof rawThinking === 'object') {
      const type = typeof rawThinking.type === 'string' ? rawThinking.type.trim().toLowerCase() : '';
      if (type === 'enabled' || type === 'disabled') {
        return { type };
      }
    }

    throw createHttpError(400, 'deepseek 的 thinking 参数格式无效，应为布尔值或 { type: "enabled|disabled" }');
  }

  return rawThinking;
}

async function processMessagesWithFiles(body, modelConfig) {
  const inlineFiles = body.files;
  const fileIds = body.fileIds;
  const hasInlineFiles = inlineFiles !== undefined && inlineFiles !== null;
  const hasFileIds = fileIds !== undefined && fileIds !== null;

  if (hasInlineFiles && !Array.isArray(inlineFiles)) {
    throw createHttpError(400, 'files 必须为数组');
  }
  if (hasFileIds && !Array.isArray(fileIds)) {
    throw createHttpError(400, 'fileIds 必须为数组');
  }

  const hasEffectiveFiles = (hasInlineFiles && inlineFiles.length > 0)
    || (hasFileIds && fileIds.length > 0);

  if (!hasEffectiveFiles) {
    return {
      messages: body.messages,
      consumedFileIds: [],
    };
  }

  if (!modelConfig.supportsFileUpload) {
    throw createHttpError(400, `模型 ${modelConfig.id} 不支持文件上传`);
  }

  const normalizedFiles = [];
  const consumedFileIds = [];

  if (hasInlineFiles) {
    normalizedFiles.push(...normalizeInlineFiles(inlineFiles));
  }
  if (hasFileIds) {
    const filesFromIds = await normalizeFilesFromIds(fileIds);
    normalizedFiles.push(...filesFromIds);
    consumedFileIds.push(...filesFromIds.map((item) => item.fileId).filter(Boolean));
  }

  if (normalizedFiles.length > env.maxFileUploadCount) {
    throw createHttpError(400, `单次最多上传 ${env.maxFileUploadCount} 个文件`);
  }

  const visionEnabled = supportsVisionMessages(modelConfig);
  const imageFiles = visionEnabled
    ? normalizedFiles.filter((file) => file.isImage && file.url)
    : [];
  const promptFiles = normalizedFiles.filter((file) => !(visionEnabled && file.isImage && file.url));
  let nextMessages = body.messages;

  if (imageFiles.length > 0) {
    nextMessages = injectImageFilesIntoMessages(nextMessages, imageFiles);
  }

  if (promptFiles.length === 0) {
    return {
      messages: nextMessages,
      consumedFileIds,
    };
  }

  return {
    messages: [
      {
        role: 'system',
        content: buildNonImageFilePrompt(promptFiles),
      },
      ...nextMessages,
    ],
    consumedFileIds,
  };
}

function buildChatPayload(body, modelConfig, stream, messages) {
  const payload = {
    model: modelConfig.id,
    messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    stream,
  };

  const passthroughFields = [
    'max_tokens',
    'top_p',
    'presence_penalty',
    'frequency_penalty',
    'stop',
    'tools',
    'tool_choice',
    'response_format',
  ];

  passthroughFields.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });

  const thinkingInput = body.thinking !== undefined
    ? body.thinking
    : (modelConfig.provider === 'qwen' ? body.enable_thinking : undefined);
  const thinking = normalizeThinkingValue(thinkingInput, modelConfig);

  if (thinking !== undefined && modelConfig.supportsThinking) {
    if (modelConfig.provider === 'qwen') {
      payload.enable_thinking = thinking;
    } else if (modelConfig.provider === 'deepseek') {
      payload.thinking = thinking;
    }
  }

  if (stream && modelConfig.provider === 'qwen') {
    payload.stream_options = {
      ...(body.stream_options && typeof body.stream_options === 'object' ? body.stream_options : {}),
      include_usage: true,
    };
  }

  return payload;
}

async function proxyChatCompletions(req, res, forceModel) {
  const requestBody = req.body || {};
  const modelId = forceModel || requestBody.model;
  const stream = typeof requestBody.stream === 'boolean' ? requestBody.stream : true;

  if (!modelId) {
    return res.status(400).json({ code: 400, msg: 'model 不能为空' });
  }
  if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
    return res.status(400).json({ code: 400, msg: 'messages 不能为空' });
  }
  if (requestBody.document && stream) {
    return res.status(400).json({ code: 400, msg: '生成文档时暂不支持 stream=true，请使用非流式请求' });
  }

  const modelConfig = MODEL_INDEX.get(modelId);
  if (!modelConfig) {
    return res.status(400).json({
      code: 400,
      msg: `不支持的模型: ${modelId}`,
      data: MODEL_CATALOG.map((item) => item.id),
    });
  }

  const provider = PROVIDER_CONFIG[modelConfig.provider];
  if (!provider || !provider.apiKey) {
    return res.status(500).json({
      code: 500,
      msg: `${modelConfig.provider} API Key 未配置`,
    });
  }

  try {
    const { messages, consumedFileIds } = await processMessagesWithFiles(requestBody, modelConfig);
    const payload = buildChatPayload(requestBody, modelConfig, stream, messages);

    logInfo('chat.proxy.request', {
      requestId: req.requestId,
      provider: modelConfig.provider,
      model: modelConfig.id,
      stream,
      messageCount: Array.isArray(messages) ? messages.length : 0,
      fileCount: (Array.isArray(requestBody.files) ? requestBody.files.length : 0)
        + (Array.isArray(requestBody.fileIds) ? requestBody.fileIds.length : 0),
      thinking: modelConfig.provider === 'deepseek'
        ? payload.thinking?.type
        : payload.enable_thinking,
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    const response = await axios.post(provider.endpoint, payload, {
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: stream ? 'stream' : 'json',
    });

    if (stream) {
      logInfo('chat.proxy.upstream_connected', {
        requestId: req.requestId,
        provider: modelConfig.provider,
        model: modelConfig.id,
        upstreamStatus: response.status,
      });
      let streamFinished = false;
      response.data.on('end', () => {
        streamFinished = true;
        void deleteUploadedFilesByIds(consumedFileIds).catch((cleanupError) => {
          logError('chat.proxy.cleanup_failed', {
            requestId: req.requestId,
            provider: modelConfig.provider,
            model: modelConfig.id,
            fileIds: consumedFileIds,
            message: cleanupError.message,
          });
        });
      });
      response.data.pipe(res);
      res.on('close', () => {
        if (!streamFinished) {
          response.data.destroy();
        }
      });
      return;
    }

    const responseData = response.data;

    if (requestBody.document) {
      const assistantText = extractAssistantText(responseData);
      if (!assistantText) {
        throw createHttpError(500, '模型响应中未找到可生成文档的正文内容');
      }

      const generatedFile = await generateDocumentFile(requestBody.document, assistantText);
      const savedFile = saveLocalFile(generatedFile);
      responseData.generatedDocument = {
        format: generatedFile.format,
        title: generatedFile.title,
        source: 'assistant_message',
        ...buildFileAccessPayload(req, savedFile),
      };
    }

    await deleteUploadedFilesByIds(consumedFileIds);
    logInfo('chat.proxy.success', {
      requestId: req.requestId,
      provider: modelConfig.provider,
      model: modelConfig.id,
      upstreamStatus: response.status,
      generatedDocument: Boolean(responseData.generatedDocument),
    });
    return res.status(response.status).json(responseData);
  } catch (error) {
    logError('chat.proxy.error', {
      requestId: req.requestId,
      provider: modelConfig.provider,
      model: modelConfig.id,
      stream,
      status: getHttpStatusCode(error),
      upstreamStatus: error.response?.status,
      message: error.message,
      upstreamData: safeSerialize(error.response?.data),
    });

    if (error.status || error.statusCode) {
      return sendJsonError(res, error);
    }

    return sendChatError(res, error);
  }
}

module.exports = {
  proxyChatCompletions,
};
