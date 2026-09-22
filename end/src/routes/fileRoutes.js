const { t } = require('../i18n');
const { MODEL_INDEX } = require('../config/models');
const { uploadDeepseekFile, imageMime } = require('../services/deepseekFileService');
const { Router } = require('express');
const { sendJsonError } = require('../utils/http');
const { generateDocumentFile } = require('../services/documentService');
const {
  extractUploadFileFromRequest,
  buildFileAccessPayload,
  getStoredFileMetadata,
  readStoredFileBuffer,
  saveLocalFile,
  saveUploadedFile,
  uploadBodyParser,
} = require('../services/fileService');

const router = Router();

router.post('/files/upload', uploadBodyParser, async (req, res) => {
  try {
    const uploadFile = extractUploadFileFromRequest(req);
    const model = MODEL_INDEX.get(req.get('x-model-id'));
    let fileMeta;
    if (model?.supportsProviderFiles) {
      const controller = new AbortController();
      const onClose = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', onClose);
      try {
        const providerFileId = await uploadDeepseekFile(uploadFile, { signal: controller.signal });
        controller.signal.throwIfAborted();
        fileMeta = saveLocalFile({ ...uploadFile, mimeType: imageMime(uploadFile.buffer), providerFileId, provider: 'deepseek' });
      } finally { res.off('close', onClose); }
    } else fileMeta = await saveUploadedFile(uploadFile);

    res.json({
      code: 200,
      msg: 'ok',
      data: { ...buildFileAccessPayload(req, fileMeta), ...(fileMeta.providerFileId ? { providerFileId: fileMeta.providerFileId } : {}) },
    });
  } catch (error) {
    return sendJsonError(res, error, t('error.upload'));
  }
});

router.post('/files/document', async (req, res) => {
  try {
    const generatedFile = await generateDocumentFile(req.body || {});
    const savedFile = saveLocalFile(generatedFile);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        format: generatedFile.format,
        title: generatedFile.title,
        ...buildFileAccessPayload(req, savedFile),
      },
    });
  } catch (error) {
    return sendJsonError(res, error, t('error.document'));
  }
});

router.get('/files/:fileId/download', async (req, res) => {
  try {
    const fileMeta = getStoredFileMetadata(req.params.fileId);
    const buffer = await readStoredFileBuffer(fileMeta);

    res.setHeader('Content-Type', fileMeta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileMeta.fileName)}`,
    );

    return res.send(buffer);
  } catch (error) {
    return sendJsonError(res, error, t('error.download'));
  }
});

module.exports = router;
