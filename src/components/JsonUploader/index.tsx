import React, { useState, useRef, useCallback } from 'react';
import './index.css';

interface JsonUploaderProps {
  onJsonUpload?: (json: any, filename: string) => void;
  maxFileSize?: number;
}

const JsonUploader = ({ onJsonUpload, maxFileSize = 1024 * 1024 }: JsonUploaderProps) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    // 验证文件类型
    if (file.type !== 'application/json') {
      setError('请选择JSON文件');
      return;
    }

    // 验证文件大小
    if (file.size > maxFileSize) {
      setError(`文件大小不能超过 ${maxFileSize / 1024}KB`);
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
        setError('无法解析JSON文件: ' + (parseError as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('读取文件时发生错误');
      setIsLoading(false);
    };

    reader.readAsText(file);
  }, [maxFileSize, onJsonUpload]);

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
          <div className="upload-status">正在处理...</div>
        ) : (
          <>
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              <p>点击或拖放JSON文件到这里</p>
              <p className="upload-hint">最大文件大小: {maxFileSize / 1024}KB</p>
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
