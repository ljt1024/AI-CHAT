import React, { useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { createPortal } from 'react-dom';
import './index.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  type?: 'alert' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  confirmButtonStyle?: React.CSSProperties;
  isDisabledConfirm?: boolean;
  onConfirm?: () => void;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  customFooter?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  type = "alert",
  confirmText,
  cancelText,
  confirmButtonStyle = {},
  isDisabledConfirm = false,
  onConfirm,
  showCloseButton = true,
  closeOnOverlayClick = true,
  customFooter,
  size = "medium",
  className = "",
}) => {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitle = title ?? t('dialog.defaultTitle');
  const dialogConfirmText = confirmText ?? t('dialog.confirm');
  const dialogCancelText = cancelText ?? t('dialog.cancel');
  
  // 处理ESC键关闭
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
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
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
  
  if (!isOpen || typeof document === 'undefined') return null;

  const dialogNode = (
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
          <h2 id="dialog-title" className="dialog-title">{dialogTitle}</h2>
          {showCloseButton && (
            <button 
              className="dialog-close"
              onClick={onClose}
              aria-label={t('dialog.close')}
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
                  {dialogCancelText}
                </button>
              )}
              <button 
                className="dialog-button confirm"
                style={confirmButtonStyle}
                onClick={handleConfirm}
                autoFocus
                disabled={isDisabledConfirm}
              >
                {dialogConfirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(dialogNode, document.body);
};

export default Dialog;
