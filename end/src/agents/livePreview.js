const { parsePartialJson } = require('@langchain/core/output_parsers');
const formats = { generate_image: 'png', export_html: 'html', export_pdf: 'pdf', export_pptx: 'pptx', export_excel: 'xlsx' };

// Snapshots are ephemeral UI drafts. They never invoke tools or become downloadable files.
function createLivePreviewEmitter(emit) {
  const last = new Map();
  return (action, status = 'generating', force = false, args) => {
    const format = formats[action.agentId];
    if (!format) return;
    const previous = last.get(action.id);
    const now = Date.now();
    if (!force && previous && now - previous.time < 120) return;
    let data = args;
    if (!data) {
      try { data = parsePartialJson(action.output || '{}'); } catch { return; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    if (format === 'png' && status === 'saving') status = 'generating';
    const preview = {
      id: action.id, toolCallId: action.toolCallId, format, status,
      title: typeof data.title === 'string' ? data.title : '',
      content: format === 'png' ? (typeof data.prompt === 'string' ? data.prompt : '') : typeof data.html === 'string' ? data.html : typeof data.content === 'string' ? data.content : '',
      slides: Array.isArray(data.slides) ? data.slides : [],
      sheets: Array.isArray(data.sheets) ? data.sheets : [],
    };
    const signature = JSON.stringify(preview);
    if (signature === previous?.signature) return;
    last.set(action.id, { time: now, signature });
    emit({ type: 'preview', preview });
  };
}
module.exports = { createLivePreviewEmitter };
