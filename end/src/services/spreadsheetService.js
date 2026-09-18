const ExcelJS = require('exceljs');
const { z } = require('zod');
const { sanitizeFileName } = require('../utils/upload');

const cellSchema = z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]);
const sheetSchema = z.object({
  name: z.string().trim().min(1).max(31).regex(/^[^\\/*?:\[\]]+$/).refine((value) => !value.startsWith("'") && !value.endsWith("'"), '工作表名称不能以单引号开头或结尾'),
  columns: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
  rows: z.array(z.array(cellSchema).min(1).max(50)).min(1).max(2000),
  sumColumns: z.array(z.number().int().min(1).max(50)).max(50).default([]).describe('需要合计的列，使用从1开始的列序号。服务端生成SUM公式，仅用于数值列；无需合计时传空数组。'),
});
const spreadsheetSchema = z.object({
  title: z.string().trim().min(1).max(100),
  sheets: z.array(sheetSchema).min(1).max(5),
}).superRefine(({ sheets }, ctx) => {
  const names = new Set();
  let cells = 0;
  sheets.forEach((sheet, i) => {
    const name = sheet.name.toLowerCase();
    if (names.has(name)) ctx.addIssue({ code: 'custom', path: ['sheets', i, 'name'], message: '工作表名称不能重复' });
    names.add(name);
    cells += sheet.rows.length * sheet.columns.length;
    if (sheet.rows.some((row) => row.length !== sheet.columns.length)) ctx.addIssue({ code: 'custom', path: ['sheets', i, 'rows'], message: '每行单元格数量必须与列数一致' });
    for (const column of sheet.sumColumns) {
      if (column > sheet.columns.length || sheet.rows.some((row) => row[column - 1] !== null && typeof row[column - 1] !== 'number')) {
        ctx.addIssue({ code: 'custom', path: ['sheets', i, 'sumColumns'], message: '合计列必须存在，且只包含数字或空值' });
      }
    }
  });
  if (cells > 20000) ctx.addIssue({ code: 'custom', message: '单个工作簿最多包含20000个数据单元格，请拆分导出' });
});

async function generateSpreadsheetFile(body, { signal } = {}) {
  const { title, sheets } = spreadsheetSchema.parse(body);
  signal?.throwIfAborted();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Chat';
  workbook.title = title;
  workbook.calcProperties.fullCalcOnLoad = true;
  for (const data of sheets) {
    const sheet = workbook.addWorksheet(data.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = data.columns.map((header, index) => ({
      header,
      width: Math.min(48, Math.max(14, header.length * 2 + 4, ...data.rows.map((row) => Math.min(String(row[index] ?? '').length * 1.5 + 2, 48)))),
    }));
    data.rows.forEach((row) => sheet.addRow(row));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: data.rows.length + 1, column: data.columns.length } };
    sheet.eachRow((row, index) => {
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, color: { argb: index === 1 ? 'FFFFFFFF' : 'FF253047' }, bold: index === 1 };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (index === 1 || index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 1 ? 'FF17365D' : 'FFF0F5FA' } };
      });
    });
    if (data.sumColumns.length) {
      const total = sheet.addRow([]);
      if (!data.sumColumns.includes(1)) total.getCell(1).value = '合计';
      for (const index of new Set(data.sumColumns)) {
        const cell = total.getCell(index);
        const result = data.rows.reduce((sum, row) => sum + (row[index - 1] ?? 0), 0);
        if (!Number.isFinite(result)) throw new Error('合计超出数值范围，请调整数据');
        const letter = sheet.getColumn(index).letter;
        cell.value = { formula: `SUM(${letter}2:${letter}${data.rows.length + 1})`, result };
      }
      total.eachCell((cell) => { cell.font = { name: 'Arial', bold: true, color: { argb: 'FF000000' } }; cell.border = { top: { style: 'thin', color: { argb: 'FF17365D' } } }; });
    }
    signal?.throwIfAborted();
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  signal?.throwIfAborted();
  return { format: 'xlsx', title, fileName: `${sanitizeFileName(title).replace(/\.xlsx$/i, '')}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer };
}

module.exports = { spreadsheetSchema, generateSpreadsheetFile };
