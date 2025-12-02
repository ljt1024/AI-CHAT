import React, { useEffect, useRef } from 'react';
import './index.css';

const Dialog = ({
  isOpen,
  onClose,
  title = "提示",
  children,
  type = "alert",
  confirmText = "确定",
  cancelText = "取消",
  confirmButtonStyle={},
  isDisabledConfirm=false,
  onConfirm,
  showCloseButton = true,
  closeOnOverlayClick = true,
  customFooter,
  size = "medium",
  className = "",
}) => {
  const dialogRef = useRef(null);
  
  // 处理ESC键关闭
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.keyCode === 27 && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);
  
  // 点击遮罩层关闭
  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // 确认按钮点击
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className={`dialog-overlay ${isOpen ? 'open' : ''}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div 
        ref={dialogRef}
        className={`dialog ${className} ${size}`}
      >
        {/* 标题区域 */}
        <div className="dialog-header">
          <h2 id="dialog-title" className="dialog-title">{title}</h2>
          {showCloseButton && (
            <button 
              className="dialog-close"
              onClick={onClose}
              aria-label="关闭对话框"
            >
              &times;
            </button>
          )}
        </div>
        
        {/* 内容区域 */}
        <div className="dialog-content">
          {children}
        </div>
        
        {/* 底部按钮区域 */}
        <div className="dialog-footer">
          {customFooter ? (
            customFooter
          ) : (
            <>
              {type === "confirm" && (
                <button 
                  className="dialog-button cancel"
                  onClick={onClose}
                >
                  {cancelText}
                </button>
              )}
              <button 
                className="dialog-button confirm"
                style={confirmButtonStyle}
                onClick={handleConfirm}
                autoFocus
                disabled={isDisabledConfirm}
              >
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dialog;
