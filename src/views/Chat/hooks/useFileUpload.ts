import { useEffect, useState } from 'react'
import { UploadedFileItem } from '@/components/ChatInputControl'
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
    setIsUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('model', selectedModelId)

      const response = await fetch(getFileUploadApiUrl(chatApiUrl), {
        method: 'POST',
        body: formData
      })
      if (!response.ok) {
        throw new Error(`file upload failed, status: ${response.status}`)
      }
      const result: FileUploadResponse = await response.json()
      const fileData = result.data || {}
      const uploadedFile: UploadedFileItem = {
        fileId: `${Date.now()}-${file.name}`,
        serverFileId: fileData.fileId,
        url: getUploadedFileUrl(fileData),
        name: fileData.fileName || file.name,
        mimeType: fileData.mimeType || file.type,
        size: fileData.size || file.size
      }
      setUploadedFiles([uploadedFile])
    } catch (error) {
      console.log(error)
    } finally {
      setIsUploadingFile(false)
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
