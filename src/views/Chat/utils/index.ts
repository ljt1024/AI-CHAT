import { Message, MessageAttachment } from '@/utils/localMessages'
import { CONTEXT_HISTORY_LIMIT, CONTEXT_MESSAGE_CHAR_LIMIT } from '../constants'
import { FileUploadResponse, RequestMessage } from '../types'

export const getModelsApiUrl = (chatApiUrl: string): string => {
  if (chatApiUrl && /^https?:\/\//.test(chatApiUrl)) {
    return new URL('/api/models', chatApiUrl).toString()
  }
  return '/api/models'
}

export const getFileUploadApiUrl = (chatApiUrl: string): string => {
  if (chatApiUrl && /^https?:\/\//.test(chatApiUrl)) {
    return new URL('/api/files/upload', chatApiUrl).toString()
  }
  return '/api/files/upload'
}

export const getUploadedFileUrl = (fileData?: FileUploadResponse['data']): string | undefined => {
  if (!fileData) return undefined
  return fileData.ossUrl || fileData.url || fileData.fileUrl
}

export const isImageAttachment = (attachment?: MessageAttachment): boolean => Boolean(
  attachment?.url && attachment.mimeType?.startsWith('image/')
)

export const isImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif|tiff?)$/i.test(file.name)
}

export const cloneMessage = (message: Message): Message => ({
  ...message,
  usage: message.usage ? { ...message.usage } : undefined,
  attachments: message.attachments ? [...message.attachments] : undefined
})

const trimContentForContext = (content: string): string => {
  const trimmedContent = content.trim()
  if (trimmedContent.length <= CONTEXT_MESSAGE_CHAR_LIMIT) {
    return trimmedContent
  }

  return `${trimmedContent.slice(0, CONTEXT_MESSAGE_CHAR_LIMIT)}\n\n[Message truncated for context]`
}

export const toRequestMessage = (
  message: Message,
  options: { includeImageAttachments: boolean; truncateContent?: boolean }
): RequestMessage | null => {
  if (message.isLoading || message.isError) return null
  if (message.role !== 'user' && message.role !== 'assistant') return null

  const contentText = options.truncateContent === false
    ? (message.content || '').trim()
    : trimContentForContext(message.content || '')
  const imageParts = options.includeImageAttachments
    ? (message.attachments || [])
      .filter(isImageAttachment)
      .map((attachment) => ({
        type: 'image_url' as const,
        image_url: {
          url: attachment.url as string
        }
      }))
    : []

  if (imageParts.length > 0) {
    return {
      role: message.role,
      content: [
        ...imageParts,
        ...(contentText ? [{ type: 'text' as const, text: contentText }] : [])
      ]
    }
  }

  if (!contentText) return null

  return {
    role: message.role,
    content: contentText
  }
}

export const buildContextMessages = (
  historyMessages: Message[],
  latestUserMessage: RequestMessage,
  includeImageAttachments: boolean
): RequestMessage[] => {
  const contextMessages = historyMessages
    .map((message) => toRequestMessage(message, {
      includeImageAttachments,
      truncateContent: true
    }))
    .filter((message): message is RequestMessage => Boolean(message))
    .slice(-CONTEXT_HISTORY_LIMIT)

  return [...contextMessages, latestUserMessage]
}
