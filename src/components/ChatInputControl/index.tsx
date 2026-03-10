import React, { useRef } from 'react';
import './index.css';

export interface UploadedFileItem {
  fileId: string;
  serverFileId?: string;
  url?: string;
  name: string;
  mimeType?: string;
  size?: number;
}

interface ChatInputControlProps {
  inputText: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onStopSSE: () => void;
  supportsFileUpload?: boolean;
  uploadedFiles?: UploadedFileItem[];
  isUploadingFile?: boolean;
  onUploadFile?: (file: File) => void;
  onRemoveUploadedFile?: (uploadedFileId: string) => void;
  variant?: 'bottom' | 'welcome';
}

const ChatInputControl: React.FC<ChatInputControlProps> = ({
  inputText,
  isLoading,
  onInputChange,
  onSubmit,
  onStopSSE,
  supportsFileUpload = false,
  uploadedFiles = [],
  isUploadingFile = false,
  onUploadFile,
  onRemoveUploadedFile,
  variant = 'bottom'
}) => {
  const hasInput = inputText.trim().length > 0
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onClickUpload = () => {
    if (!supportsFileUpload || isLoading || isUploadingFile) return
    fileInputRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUploadFile) {
      onUploadFile(file)
    }
    e.target.value = ''
  }

  return (
    <form className={`input-area ${variant === 'welcome' ? 'input-area--welcome' : ''}`.trim()} onSubmit={onSubmit}>
      <div className="input-container">
        <div className="input-wrapper">
          <div className="input-left">
            {/* <div className="input-settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div> */}
          </div>
          <div className="input-center">
            <textarea
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="请输入你的问题..."
              disabled={isLoading}
              rows={2}
              spellCheck={false}
            />
          </div>
        </div>
        {supportsFileUpload && (uploadedFiles.length > 0 || isUploadingFile) && (
          <div className="uploaded-file-list">
            {uploadedFiles.map((file) => (
              <div className="uploaded-file-item" key={file.fileId}>
                <span className="uploaded-file-name" title={file.name}>{file.name}</span>
                {onRemoveUploadedFile && (
                  <button
                    type="button"
                    className="uploaded-file-remove"
                    onClick={() => onRemoveUploadedFile(file.fileId)}
                    aria-label={`移除${file.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {isUploadingFile && <div className="uploaded-file-uploading">文件上传中...</div>}
          </div>
        )}
        <div className="send-button-row">
          <div className="send-button-left">
            {supportsFileUpload && (
              <>
                <button
                  type="button"
                  className={`input-attach ${isUploadingFile ? 'is-uploading' : ''}`.trim()}
                  onClick={onClickUpload}
                  disabled={isLoading || isUploadingFile}
                  title={isUploadingFile ? '文件上传中...' : '上传文件'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="file-input-hidden"
                  onChange={onFileChange}
                />
              </>
            )}
          </div>
          <div className="send-button-right">
            {
              !isLoading ?
                <button
                  type="submit"
                  disabled={!hasInput}
                  className={`input-send ${hasInput ? 'input-send--active' : 'input-send--idle'}`.trim()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
                :
                <button type="button" className='stop-btn input-send' onClick={onStopSSE}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                </button>
            }
          </div>
        </div>
      </div>
    </form>
  );
};

export default ChatInputControl;
