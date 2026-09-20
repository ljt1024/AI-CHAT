const { t } = require('../i18n');
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
    const fileMeta = await saveUploadedFile(uploadFile);

    res.json({
      code: 200,
      msg: 'ok',
      data: buildFileAccessPayload(req, fileMeta),
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
