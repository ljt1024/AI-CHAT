import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './index.css';

interface PopoverProps {
  title?: string;
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
  trigger?: 'click' | 'hover' | 'focus';
  className?: string;
  style?: React.CSSProperties;
  onVisibleChange?: (visible: boolean) => void;
  [key: string]: any;
}

const Popover: React.FC<PopoverProps> = ({
  title,
  content,
  children,
  placement = 'top',
  trigger = 'click',
  className = '',
  style = {},
  onVisibleChange
}) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [position, setPosition] = useState<{left?: number; top?: number}>({})
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<any>(null);
  // 处理显示/隐藏状态变化
  useEffect(() => {
    if (onVisibleChange) {
      onVisibleChange(visible);
    }
    if (visible) {
        calculatePosition()
    }

  }, [visible, onVisibleChange]);

  // 点击外部区域关闭popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setVisible(false);
      }
    };

    if (visible && trigger === 'click') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [visible, trigger]);

  // 处理触发事件
  const handleTrigger = (e: React.MouseEvent) => {
    if (trigger === 'click') {
      setVisible(!visible);
      e.stopPropagation()
    }
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      clearTimeout(timeoutRef.current);
      setVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      timeoutRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 200);
    }
  };

  // 计算位置
  const calculatePosition = () => {
    if (!triggerRef.current || !popoverRef.current) return {};
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    //TODO 解决容器滚动高度
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    triggerRef.current.addEventListener('scoll', (res)=>{
        console.log(res)
    })  
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = triggerRect.top + scrollY - popoverRect.height - 10;
        left = triggerRect.left + scrollX + (triggerRect.width - popoverRect.width) / 2;
        break;
      case 'top-start':
        top = triggerRect.top + scrollY - popoverRect.height - 10;
        left = triggerRect.left + scrollX;
        break;
      case 'top-end':
        top = triggerRect.top + scrollY - popoverRect.height - 10;
        left = triggerRect.left + scrollX + triggerRect.width - popoverRect.width;
        break;
      case 'bottom':
        top = triggerRect.bottom + scrollY + 10;
        left = triggerRect.left + scrollX + (triggerRect.width - popoverRect.width) / 2;
        break;
      case 'bottom-start':
        top = triggerRect.bottom + scrollY + 10;
        left = triggerRect.left + scrollX;
        break;
      case 'bottom-end':
        top = triggerRect.bottom + scrollY + 10;
        left = triggerRect.left + scrollX + triggerRect.width - popoverRect.width;
        break;
      case 'left':
        top = triggerRect.top + scrollY + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.left + scrollX - popoverRect.width - 10;
        break;
      case 'left-start':
        top = triggerRect.top + scrollY;
        left = triggerRect.left + scrollX - popoverRect.width - 10;
        break;
      case 'left-end':
        top = triggerRect.top + scrollY + triggerRect.height - popoverRect.height;
        left = triggerRect.left + scrollX - popoverRect.width - 10;
        break;
      case 'right':
        top = triggerRect.top + scrollY + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.right + scrollX + 10;
        break;
      case 'right-start':
        top = triggerRect.top + scrollY;
        left = triggerRect.right + scrollX + 10;
        break;
      case 'right-end':
        top = triggerRect.top + scrollY + triggerRect.height - popoverRect.height;
        left = triggerRect.right + scrollX + 10;
        break;
      default:
        top = triggerRect.top + scrollY - popoverRect.height - 10;
        left = triggerRect.left + scrollX + (triggerRect.width - popoverRect.width) / 2;
    }

    // 确保不超出视口边界
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 10) left = 10;
    if (left + popoverRect.width > viewportWidth - 10) {
      left = viewportWidth - popoverRect.width - 10;
    }

    if (top < 10) top = 10;
    if (top + popoverRect.height > viewportHeight + scrollY - 10) {
      top = viewportHeight + scrollY - popoverRect.height - 10;
    }

    setPosition({top, left})
  };

  // 设置事件处理器
  const eventHandlers: React.HTMLAttributes<HTMLDivElement> = {};
  if (trigger === 'click') {
    eventHandlers.onClick = handleTrigger;
  } else if (trigger === 'hover') {
    eventHandlers.onMouseEnter = handleMouseEnter;
    eventHandlers.onMouseLeave = handleMouseLeave;
  } else if (trigger === 'focus') {
    eventHandlers.onFocus = handleMouseEnter;
    eventHandlers.onBlur = handleMouseLeave;
  }

  return (
    <div className='popover-wrapper'>
      <div
        ref={triggerRef}
        className="popover-trigger"
        {...eventHandlers}
        aria-describedby={visible ? "popover-content" : undefined}
      >
        {children}
      </div>

      {visible && createPortal(
        <div
          ref={popoverRef}
          id="popover-content"
          className={`popover-container popover-${placement} ${className}`}
          style={{ ...position, ...style }}
          onClick={(e: React.MouseEvent) => { setVisible(false); e.stopPropagation(); }}
          onMouseEnter={trigger === 'hover' ? handleMouseEnter : undefined}
          onMouseLeave={trigger === 'hover' ? handleMouseLeave : undefined}
          role="tooltip"
        >
          {/* <div className="popover-arrow"></div> */}
          <div className="popover-inner">
            {title && <div className="popover-title">{title}</div>}
            <div className="popover-content">{content}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Popover;
