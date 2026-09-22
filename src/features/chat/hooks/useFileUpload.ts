import { languageHeaders, t } from '@/app/i18n';
import { useMessagePop } from '@/shared/components/MessagePop';
import { useEffect, useRef, useState } from 'react'
import { UploadedFileItem } from '@/shared/components/ChatInputControl'
import { FileUploadResponse } from '../types'
import { getFileUploadApiUrl, getUploadedFileUrl, isImageFile } from '../utils'

interface UseFileUploadOptions {
  chatApiUrl: string;
  selectedModelId: string;
  supportsFileUpload: boolean;
  supportsImageUnderstanding: boolean;
  isLoading: boolean;
}

export const useFileUpload = ({
  chatApiUrl,
  selectedModelId,
  supportsFileUpload,
  supportsImageUnderstanding,
  isLoading
}: UseFileUploadOptions) => {
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => {
    setUploadedFiles([]);
    setIsUploadingFile(false);
    return () => { uploadController.current?.abort(); uploadController.current = null; };
  }, [selectedModelId]);
  const messagePop = useMessagePop();
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])

  useEffect(() => {
    if (!supportsFileUpload && uploadedFiles.length > 0) {
      setUploadedFiles([])
    }
  }, [supportsFileUpload, uploadedFiles.length])

  const onUploadFile = async (file: File) => {
    if (!supportsFileUpload || isUploadingFile || isLoading) return
    if (supportsImageUnderstanding && !isImageFile(file)) return
    const controller = new AbortController();
    uploadController.current = controller;
    setIsUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('model', selectedModelId)

      const response = await fetch(getFileUploadApiUrl(chatApiUrl), {
        method: 'POST', signal: controller.signal, headers: { ...languageHeaders(), 'x-model-id': selectedModelId },
        body: formData
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.msg || t('input.uploadError'))
      }
      const result: FileUploadResponse = await response.json()
      const fileData = result.data || {}
      const uploadedFile: UploadedFileItem = {
        fileId: `${Date.now()}-${file.name}`,
        serverFileId: fileData.fileId,
        providerFileId: fileData.providerFileId,
        url: getUploadedFileUrl(fileData),
        name: fileData.fileName || file.name,
        mimeType: fileData.mimeType || file.type,
        size: fileData.size || file.size
      }
      if (!controller.signal.aborted) setUploadedFiles([uploadedFile])
    } catch (error) {
      if (!controller.signal.aborted) messagePop.error(error instanceof Error ? error.message : t('input.uploadError'))
    } finally {
      if (uploadController.current === controller) { setIsUploadingFile(false); uploadController.current = null; }
    }
  }

  const onRemoveUploadedFile = (uploadedFileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.fileId !== uploadedFileId))
  }

  return {
    uploadedFiles,
    isUploadingFile,
    setUploadedFiles,
    onUploadFile,
    onRemoveUploadedFile
  }
}
