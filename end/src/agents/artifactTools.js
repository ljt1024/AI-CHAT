const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { generateDocumentFile } = require('../services/documentService');
const { generateSpreadsheetFile, spreadsheetSchema } = require('../services/spreadsheetService');
const { saveLocalFile, buildFileAccessPayload } = require('../services/fileService');
const { generatePresentationFile, presentationSchema } = require('../services/presentationService');

function createArtifactTools({ saveFile = saveLocalFile } = {}) {
  const exportFile = async (generate, args, config) => {
    config?.signal?.throwIfAborted();
    const file = await generate(args, { signal: config?.signal });
    config?.signal?.throwIfAborted();
    const previewMeta = file.previewFile ? saveFile(file.previewFile) : null;
    const metadata = saveFile(file);
    const artifact = { ...buildFileAccessPayload(null, metadata), format: file.format, ...(previewMeta ? { previewFileId: previewMeta.fileId, pageCount: file.pageCount } : {}) };
    config?.configurable?.onArtifact?.(artifact);
    return JSON.stringify({ message: '文件已生成，可通过下载卡片下载。', ...artifact });
  };
  return [
    tool((args, config) => exportFile((body, options) => generateDocumentFile({ ...body, format: 'pdf' }, '', options), args, config), {
      name: 'export_pdf',
      description: '将完整文本生成可下载的中文PDF报告。传入标题和实际正文（支持段落、#标题、列表），不要只给大纲或声称已生成。生成后返回真实下载地址。',
      schema: z.object({ title: z.string().trim().min(1).max(100), content: z.string().trim().min(1).max(100000) }),
    }),
    tool((args, config) => exportFile(generateSpreadsheetFile, args, config), {
      name: 'export_excel', description: '生成可下载的Excel .xlsx工作簿，支持多个工作表、列标题、数字/文本/布尔/空值及SUM合计列。rows必须与columns长度一致，字符串按文本写入，sumColumns从1计数。不得虚构用户数据。', schema: spreadsheetSchema,
    }),
    tool((args, config) => exportFile(generatePresentationFile, args, config), {
      name: 'export_pptx',
      description: '生成可下载的PowerPoint演示文稿。传入完整标题和每页实际内容，slides为1-20页，每页包含title（最多40字）和body（1-4条，每条最多100字）。长内容必须拆页，不能省略用户要求的信息。',
      schema: presentationSchema,
    }),
  ];
}

module.exports = { createArtifactTools };
