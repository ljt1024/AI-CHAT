const { t } = require('../i18n');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { generateDocumentFile } = require('../services/documentService');
const { generateSpreadsheetFile, spreadsheetSchema } = require('../services/spreadsheetService');
const { saveLocalFile, buildFileAccessPayload } = require('../services/fileService');
const { generatePresentationFile, presentationSchema } = require('../services/presentationService');
const { generateHtmlFile, htmlSchema } = require('../services/htmlService');

const { generateImageFile, imageSchema } = require('../services/imageService');

function createArtifactTools({ saveFile = saveLocalFile, generateImage = generateImageFile } = {}) {
  const exportFile = async (generate, args, config) => {
    config?.signal?.throwIfAborted();
    const file = await generate(args, { signal: config?.signal });
    config?.signal?.throwIfAborted();
    if (file.previewContent && config?.configurable?.onPreview) {
      config.configurable.onPreview({
        kind: file.format,
        title: file.title,
        content: file.previewContent,
        complete: true,
      });
    }
    const previewMeta = file.previewFile ? saveFile(file.previewFile) : null;
    const metadata = saveFile(file);
    const artifact = { ...buildFileAccessPayload(null, metadata), format: file.format, ...(previewMeta ? { previewFileId: previewMeta.fileId, pageCount: file.pageCount } : {}) };
    config?.configurable?.onArtifact?.(artifact);
    return JSON.stringify({ message: t('artifact.ready'), ...artifact });
  };
  return [
    tool((args, config) => exportFile(generateImage, args, config), {
      name: 'generate_image', description: t('tool.image'), schema: imageSchema,
    }),
    tool((args, config) => exportFile(generateHtmlFile, args, config), {
      name: 'export_html',
      description: t('tool.html'),
      schema: htmlSchema,
    }),
    tool((args, config) => exportFile((body, options) => generateDocumentFile({ ...body, format: 'pdf' }, '', options), args, config), {
      name: 'export_pdf',
      description: t('tool.pdf'),
      schema: z.object({ title: z.string().trim().min(1).max(100), content: z.string().trim().min(1).max(100000) }),
    }),
    tool((args, config) => exportFile(generateSpreadsheetFile, args, config), {
      name: 'export_excel', description: t('tool.excel'), schema: spreadsheetSchema,
    }),
    tool((args, config) => exportFile(generatePresentationFile, args, config), {
      name: 'export_pptx',
      description: t('tool.pptx'),
      schema: presentationSchema,
    }),
  ];
}

module.exports = { createArtifactTools };
