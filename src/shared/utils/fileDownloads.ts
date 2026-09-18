export function getFileDownloadUrl(fileId: string): string {
  const chatUrl = import.meta.env.VITE_CHAT_BASE_URL || '/api/chat/completions';
  const base = new URL(chatUrl, window.location.origin);
  return new URL(`/api/files/${encodeURIComponent(fileId)}/download`, base).toString();
}

export function resolveFileDownloadUrl(href?: string): string | undefined {
  const match = href?.match(/^\/api\/files\/([a-f0-9-]{36})\/download$/i);
  return match ? getFileDownloadUrl(match[1]) : href;
}
