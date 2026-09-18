import {
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode
} from 'react';
import ReactDOM from 'react-dom';

import './index.css'

type Placement = 'top' | 'bottom' | 'left' | 'right';
type Trigger = 'hover' | 'click';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  placement?: Placement;
  trigger?: Trigger;
  style?: React.CSSProperties;
  className?: string;
  delay?: number;
  disabled?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  placement = 'top',
  trigger = 'hover',
  style = {},
  className = '',
  delay = 0,
  disabled = false
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const delayTimer = useRef<NodeJS.Timeout | null>(null);

  // 计算位置
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = (triggerRef.current as HTMLElement).getBoundingClientRect();
    const tooltipRect = (tooltipRef.current as HTMLElement).getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height + scrollY - 10;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 + scrollX;
        break;
      case 'bottom':
        top = triggerRect.bottom + scrollY + 10;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 + scrollX;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2 + scrollY;
        left = triggerRect.left - tooltipRect.width + scrollX;
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2 + scrollY;
        left = triggerRect.right + scrollX;
        break;
    }

    // 边界检测（防止超出视口）
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left < scrollX) {
      left = scrollX;
    } else if (left + tooltipRect.width > scrollX + viewportWidth) {
      left = scrollX + viewportWidth - tooltipRect.width;
    }
    
    if (top < scrollY) {
      top = scrollY;
    } else if (top + tooltipRect.height > scrollY + viewportHeight) {
      top = scrollY + viewportHeight - tooltipRect.height;
    }

    setCoords({ top, left });
  }, [placement]);

  // 显示tooltip
  const showTooltip = useCallback(() => {
    if (disabled) return;
    
    if (delayTimer.current) {
      clearTimeout(delayTimer.current);
    }
    
    delayTimer.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay, disabled]);

  // 隐藏tooltip
  const hideTooltip = useCallback(() => {
    if (delayTimer.current) {
      clearTimeout(delayTimer.current);
      delayTimer.current = null;
    }
    setVisible(false);
  }, []);

  // 点击外部关闭
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      tooltipRef.current && 
      !(tooltipRef.current as HTMLElement).contains(e.target as Node) && 
      triggerRef.current &&
      !(triggerRef.current as HTMLElement).contains(e.target as Node)
    ) {
      hideTooltip();
    }
  }, [hideTooltip]);

  // 事件绑定
  useEffect(() => {
    const triggerElement = triggerRef.current;
    if (!triggerElement) return;

    if (trigger === 'hover') {
      triggerElement.addEventListener('mouseenter', showTooltip);
      triggerElement.addEventListener('mouseleave', hideTooltip);
    } else if (trigger === 'click') {
      triggerElement.addEventListener('click', showTooltip);
    }

    return () => {
      if (trigger === 'hover') {
        triggerElement.removeEventListener('mouseenter', showTooltip);
        triggerElement.removeEventListener('mouseleave', hideTooltip);
      } else if (trigger === 'click') {
        triggerElement.removeEventListener('click', showTooltip);
      }
    };
  }, [trigger, showTooltip, hideTooltip]);

  // 显示时计算位置并添加事件
  useEffect(() => {
    if (visible) {
      calculatePosition();
      
      // 添加窗口变化监听
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition);
      
      // 点击外部关闭
      if (trigger === 'click') {
        document.addEventListener('mousedown', handleClickOutside);
      }
    }

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, trigger, calculatePosition, handleClickOutside]);

  // 动画类名
  const getAnimationClass = () => {
    if (!visible) return '';
    
    switch (placement) {
      case 'top': return 'animate-fade-in-down';
      case 'bottom': return 'animate-fade-in-up';
      case 'left': return 'animate-fade-in-right';
      case 'right': return 'animate-fade-in-left';
      default: return 'animate-fade-in';
    }
  };

  // 创建Portal渲染Tooltip
  const renderTooltip = () => {
    if (!visible || !content) return null;

    return ReactDOM.createPortal(
      <div
        ref={tooltipRef}
        className={`tooltip absolute ${getAnimationClass()} ${className}`}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          ...style
        }}
        onMouseEnter={trigger === 'hover' ? showTooltip : undefined}
        onMouseLeave={trigger === 'hover' ? hideTooltip : undefined}
      >
        {content}
        {/* 小三角箭头 */}
        <div className={`absolute ${getArrowClass(placement)} tooltip-arrow`} />
      </div>,
      document.body
    );
  };

  // 获取箭头位置类名
  const getArrowClass = (pos: Placement) => {
    switch (pos) {
      case 'top': return 'tooltip-arrow-top';
      case 'bottom': return 'tooltip-arrow-bottom';
      case 'left': return 'tooltip-arrow-left';
      case 'right': return 'tooltip-arrow-right';
      default: return '';
    }
  };

  return (
    <>
      <span ref={triggerRef} className="inline-block">
        {children}
      </span>
      {renderTooltip()}
    </>
  );
};

export default Tooltip;
