import React, { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import './index.css';

interface JsonUploaderProps {
  onJsonUpload?: (json: any, filename: string) => void;
  maxFileSize?: number;
}

const JsonUploader = ({ onJsonUpload, maxFileSize = 1024 * 1024 }: JsonUploaderProps) => {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    // 验证文件类型
    if (file.type !== 'application/json') {
      setError(t('json.selectJson'));
      return;
    }

    // 验证文件大小
    if (file.size > maxFileSize) {
      setError(t('json.maxFileSize', { size: maxFileSize / 1024 }));
      return;
    }

    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const jsonContent = JSON.parse(e.target?.result as string);
        onJsonUpload && onJsonUpload(jsonContent, file.name);
        setError(null);
      } catch (parseError) {
        setError(t('json.parseError', { message: (parseError as Error).message }));
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError(t('json.readError'));
      setIsLoading(false);
    };

    reader.readAsText(file);
  }, [maxFileSize, onJsonUpload, t]);

  // 处理点击上传
  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  // 处理文件输入变化
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // 重置input值，允许重复选择同一文件
    e.target.value = '';
  };

  // 处理拖放事件
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="json-uploader">
      <div 
        className={`upload-area ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
      >
        {isLoading ? (
          <div className="upload-status">{t('json.processing')}</div>
        ) : (
          <>
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              <p>{t('json.dropHint')}</p>
              <p className="upload-hint">{t('json.fileSizeHint', { size: maxFileSize / 1024 })}</p>
            </div>
          </>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default JsonUploader;
