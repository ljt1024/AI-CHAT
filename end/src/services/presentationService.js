const { t } = require('../i18n');
const pptxgen = require('pptxgenjs');
const PDFDocument = require('pdfkit');
const path = require('node:path');
const { z } = require('zod');
const { sanitizeFileName } = require('../utils/upload');

const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const presentationSchema = z.object({
  title: z.string().trim().min(1).max(100),
  slides: z.array(z.object({
    title: z.string().trim().min(1).max(40),
    body: z.array(z.string().trim().min(1).max(100)).min(1).max(4),
  })).min(1).max(20),
});
const fontPath = path.join(__dirname, '../../assets/fonts/NotoSansCJKsc-Regular.otf');

// Both outputs use the same measured lines and coordinates (points).
function wrapText(doc, text, size, width) {
  doc.fontSize(size);
  const lines = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { lines.push(line); line = ''; continue; }
    if (line && doc.widthOfString(line + char) > width) { lines.push(line); line = ''; }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
}

async function generatePresentationFile(input, { signal } = {}) {
  signal?.throwIfAborted();
  const { title, slides } = presentationSchema.parse(input);
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'AI Chat';
  pptx.title = title;
  pptx.theme = { headFontFace: 'Noto Sans CJK SC', bodyFontFace: 'Noto Sans CJK SC', lang: 'zh-CN' };
  const pdf = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: title, Author: 'AI Chat' } });
  const chunks = [];
  const previewBuffer = new Promise((resolve, reject) => {
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  // Attach a rejection handler immediately, including for synchronous layout failures.
  previewBuffer.catch(() => {});
  try {
    pdf.font(fontPath);
    slides.forEach((item, index) => {
      signal?.throwIfAborted();
      const slide = pptx.addSlide();
      const dark = index === 0;
      const background = dark ? '17365D' : 'F5F9FF';
      const ink = dark ? 'FFFFFF' : '17365D';
      slide.background = { color: background };
      pdf.addPage({ size: [720, 405], margin: 0 });
      pdf.rect(0, 0, 720, 405).fill(`#${background}`);
      const rect = (x, y, w, h, color) => {
        pdf.rect(x, y, w, h).fill(`#${color}`);
        slide.addShape(pptx.ShapeType.rect, { x: x / 72, y: y / 72, w: w / 72, h: h / 72, fill: { color }, line: { color, transparency: 100 } });
      };
      const text = (value, x, y, size, color, width = 620) => {
        pdf.fontSize(size).fillColor(`#${color}`).text(value, x, y, { lineBreak: false });
        slide.addText(value, { x: x / 72, y: y / 72, w: width / 72, h: size * 1.5 / 72, fontSize: size, color, margin: 0, valign: 'top', breakLine: false });
      };
      // A numbered chapter tile anchors every page without taking space from the content.
      rect(47, 40, 32, 32, dark ? '315E88' : 'DFEBF8');
      text(String(index + 1).padStart(2, '0'), 52, 45, 14, ink, 28);
      const titleLines = wrapText(pdf, item.title, 26, 565);
      if (titleLines.length > 2) throw new Error(t('error.slideTitle'));
      titleLines.forEach((line, i) => text(line, 98, 36 + i * 34, 26, ink, 575));
      let y = 125;
      const rows = item.body.map(value => wrapText(pdf, value, 16, 580));
      const needed = rows.reduce((sum, lines) => sum + lines.length * 23 + 10, 0);
      if (needed > 235) throw new Error(t('error.slideBody'));
      rows.forEach((lines, i) => {
        text(String(i + 1).padStart(2, '0'), 49, y + 2, 10, dark ? 'A4CAE9' : '55738D', 25);
        lines.forEach((line, j) => text(line, 84, y + j * 23, 16, dark ? 'E8F2FF' : '253047', 590));
        y += lines.length * 23 + 10;
      });
      text(`${index + 1} / ${slides.length}`, 630, 373, 9, dark ? 'B8D4F0' : '577189', 50);
    });
    pdf.end();
    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    const preview = await previewBuffer;
    signal?.throwIfAborted();
    const baseName = sanitizeFileName(title).replace(/\.pptx?$/i, '');
    return {
      format: 'pptx', fileName: `${baseName}.pptx`, mimeType: PPTX_MIME_TYPE, buffer, title,
      previewFile: { fileName: `${baseName}-preview.pdf`, mimeType: 'application/pdf', buffer: preview },
      pageCount: slides.length,
    };
  } catch (error) { pdf.destroy(error); throw error; }
}

module.exports = { PPTX_MIME_TYPE, generatePresentationFile, presentationSchema };
