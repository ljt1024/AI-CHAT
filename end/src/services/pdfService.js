const { t } = require('../i18n');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const fontPath = path.join(__dirname, '../../assets/fonts/NotoSansCJKsc-Regular.otf');

function generatePdfBuffer({ title, paragraphs }, { signal } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 52, info: { Title: title || t('file.document'), Author: 'AI Chat' } });
    const chunks = [];
    const onAbort = () => doc.destroy(signal.reason instanceof Error ? signal.reason : new Error(t('file.stopped')));
    signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', (error) => { cleanup(); reject(error); });
    doc.on('end', () => { cleanup(); resolve(Buffer.concat(chunks)); });
    try {
      doc.font(fontPath);
      if (title) {
        doc.fontSize(21).fillColor('#17365D').text(title, { lineGap: 5 });
        doc.moveDown(0.8);
      }
      let firstBodyLine = true;
      for (const paragraph of paragraphs) {
        signal?.throwIfAborted();
        for (const line of paragraph.split('\n')) {
          const heading = /^(#{1,6})\s+(.+)$/.exec(line);
          const content = (heading ? heading[2] : line).replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
          if (firstBodyLine && content.trim()) {
            firstBodyLine = false;
            if (title && content.trim() === title.trim()) continue;
          }
          doc.fontSize(heading ? 15 : 11).fillColor(heading ? '#17365D' : '#253047');
          doc.text(content || ' ', { lineGap: 5, paragraphGap: 5 });
        }
        doc.moveDown(0.4);
      }
      doc.end();
    } catch (error) { doc.destroy(error); }
  });
}

module.exports = { generatePdfBuffer };
