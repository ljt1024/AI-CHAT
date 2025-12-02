// src/components/Message/Message.jsx
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

// 图标组件
const SuccessIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style={{color: 'green'}}>
    <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm6.8 8.4l-7.3 8.1a1 1 0 01-1.5 0l-3.2-3.6a1 1 0 011.5-1.4l2.5 2.8 6.6-7.3a1 1 0 011.4 1.4z" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm6.7 16.3a1 1 0 01-1.4 1.4L12 13.4l-5.3 5.3a1 1 0 01-1.4-1.4L10.6 12 5.3 6.7A1 1 0 016.7 5.3L12 10.6l5.3-5.3a1 1 0 011.4 1.4L13.4 12z" />
  </svg>
);

const InfoIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm1 18a1 1 0 01-2 0v-6a1 1 0 012 0zm-1-9a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  </svg>
);

const WarningIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm1 16a1 1 0 01-2 0v-4a1 1 0 012 0zm-1-7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="loading-spinner" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25" />
    <path d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z">
      <animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite" />
    </path>
  </svg>
);

// 消息项组件
const MessageItem = ({ id, type, content, duration = 2000, onClose, style }) => {

  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // 显示动画
    setVisible(true);

    // 设置自动关闭定时器
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        // 给动画留出时间
        setTimeout(() => onClose(id), 300);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, id, onClose]);

  // 手动关闭消息
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(id), 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return <SuccessIcon style={{color: 'green'}}/>;
      case 'error': return <ErrorIcon />;
      case 'info': return <InfoIcon />;
      case 'warning': return <WarningIcon />;
      case 'loading': return <LoadingIcon />;
      default: return null;
    }
  };

  return (
    <div
      className={`messagePop-item ${type} ${visible ? 'visible' : ''}`}
      style={style}
      onClick={handleClose}
    >
      <div className="messagePop-icon">{getIcon()}</div>
      <div className="messagePop-content">{content}</div>
    </div>
  );
};

MessageItem.defaultProps = {
  type: 'info',
  duration: 3000
};

// 消息容器组件
const MessageContainer = (props) => {

  const { position, messages, removeMessage } = props

  return (
    <>
      {/* 消息容器 */}
      <div className={`messagePop-container ${position}`}>
        {messages.map(msg => (
          <MessageItem
            key={msg.id}
            id={msg.id}
            type={msg.type}
            content={msg.content}
            duration={msg.duration}
            onClose={removeMessage}
            style={msg.style}
          />
        ))}
      </div>
    </>
  );
};

// 自定义Hook使用消息组件
const useMessagePop = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessagePop must be used within a MessageProvider');
  }
  return context;
};

// 创建Context
const MessageContext = createContext(null);

// 消息提供者组件
const MessagePopProvider = ({ children, ...props }) => {
  const [messages, setMessages] = useState([]);
  const position = 'topCenter';
  const maxCount = 5;
  // 添加消息
  const addMessage = (message) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);

    setMessages(prev => {
      // 限制最大消息数量
      const newMessages = [...prev, { ...message, id }];
      if (newMessages.length > maxCount) {
        return newMessages.slice(newMessages.length - maxCount);
      }
      return newMessages;
    });
  };

  // 移除消息
  const removeMessage = (id) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  // 清空所有消息
  const clearAll = () => {
    setMessages([]);
  };

  // 暴露方法给上下文
  const api = {
    success: (content, duration) => addMessage({ type: 'success', content, duration }),
    error: (content, duration) => addMessage({ type: 'error', content, duration }),
    info: (content, duration) => addMessage({ type: 'info', content, duration }),
    warning: (content, duration) => addMessage({ type: 'warning', content, duration }),
    loading: (content, duration) => addMessage({ type: 'loading', content, duration }),
    custom: (options) => addMessage(options),
    clear: clearAll
  };



  return (
    <MessageContext.Provider value={api}>
      {children}
      <MessagePortal
        position={position}
        removeMessage={removeMessage}
        messages={messages}
      />
    </MessageContext.Provider>
  );
};

// 使用Portal渲染消息容器
const MessagePortal = (props) => {
  const [container] = useState(() => {
    const els = document.querySelectorAll('.global-message-container')
    if (els.length > 0) {
       return els[0] 
    }
    const div = document.createElement('div');
    div.className = 'global-message-container';
    document.body.appendChild(div);
    return div;
  });

  useEffect(() => {
    return () => {
      // document.body.removeChild(container);
    };
  }, [container]);

  return ReactDOM.createPortal(<MessageContainer {...props} />, container);
};

export { MessagePopProvider, useMessagePop };