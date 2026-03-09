import { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownContent from '../MarkDownContent';
import Tooltip from '../Tooltip';
import Icon from '../Icon';
import BotIcon from '../../assets/bot.svg';
import UserIcon from '../../assets/user.svg';
import CopyIcon from "../../assets/icons/copy.svg?react";
import FoldArrowIcon from '../../assets/foldArrow.png';
import { debounce } from '../../utils';
import { useCopy } from '../../hooks/useCopy';
import { useMessagePop } from '../MessagePop';
import { Message as MessageType } from '../../utils/localMessages';

import './index.css'

interface MessageItemProps {
  msg: MessageType;
  setIsShowShare: (show: boolean) => void;
  setShareTarget: (target: HTMLElement | null) => void;
  currentShareMessage?: any;
  botName?: string;
  canRetry?: boolean;
  onRetry?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  setIsShowShare,
  setShareTarget,
  currentShareMessage: _currentShareMessage,
  botName = 'AI Assistant',
  canRetry = false,
  onRetry
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const { handleCopy } = useCopy()
  const messagePop = useMessagePop()

  const checkHeight = useCallback(
    debounce(() => {
      console.log(contentRef.current)
      if (contentRef.current) {
        const shouldCollapse = contentRef.current.scrollHeight > 200;
        console.log(shouldCollapse, 'shouldCollapse')
        setIsExpanded(shouldCollapse);
      }
    }, 300),
    []
  );

  useEffect(() => {
    checkHeight()
  }, [msg]);

  const onShare = () => {
    setShareTarget(shareRef.current)
    setIsShowShare(true)
  }

  const onCopy = () => {
    handleCopy(msg.content || '', () => {
      messagePop.success('复制成功')
    })
  }

  const onRetryHandle = () => {
    if (!canRetry || !onRetry) return
    onRetry()
  }

  return (
    <div
      className={`message ${msg.isBot ? 'bot' : 'user'}`}
      style={{ animation: 'messageIn 0.45s ease-out' }}

    >
      {/* <div className="avatar">
        {msg.isBot ? (
          <img src={BotIcon} alt="AI" className="bot-avatar" />
        ) : (
          <img src={UserIcon} alt="用户" className="bot-avatar" />
        )}
      </div> */}
      <div className="bubble-wrap" ref={contentRef}>
        {
          msg.isBot && <div className='botName'>{botName}</div>
        }
        {
          !msg.isBot && <div className='userTime'>
            {msg.timestamp && new Date(msg.timestamp).toLocaleString()}
          </div>
        }
        <div className={`${msg.isBot && isExpanded ? 'bubble bubbleFold' : 'bubble'}`} ref={shareRef}>
          <div className={msg.isBot ? 'content' : 'content userContent'}>
            {
              msg.isBot ? <>
                {
                  msg.reasoning_content && <blockquote>
                    <MarkdownContent msg={msg.reasoning_content || ''} />
                  </blockquote>
                }
                <MarkdownContent msg={msg.content || ''} />
              </>
                : msg.content || ''
            }
          </div>

        </div>
        {!msg.isError && (
          <div className={msg.isBot ? 'timestamp' : 'timestamp userTimestamp'}>
            <div className='footerInfo'>
              {!msg.isBot &&
                <Tooltip content="复制" placement="bottom">
                  <Icon
                    sourceType="svg"
                    source={CopyIcon}
                    size={16}
                    color="var(--icon-color)"
                    onClick={onCopy}
                  />
                </Tooltip>
              }
              {
                msg.isBot && !msg.isLoading &&
                <span className='tokenInfo'>
                  <span>输入token：{msg?.usage?.prompt_tokens}</span>
                  <span style={{ paddingLeft: '8px' }}>输出token：{msg?.usage?.completion_tokens}</span>
                </span>
              }
            </div>
            {msg.isBot && !msg.isLoading &&
              <div className='botActions'>
                {canRetry && (
                  <Tooltip content="重试" placement="bottom">
                    <button type="button" className='retry' onClick={onRetryHandle}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 21v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </Tooltip>
                )}
                <Tooltip content="分享" placement="bottom">
                  <button type="button" className='retry' onClick={onShare}>
                    <svg
                      className='share'
                      viewBox="0 0 1024 1024"
                      width="18"
                      height="18"
                    >
                      <path d="M425.637161 337.127226l0.016516-106.19871c0-77.790968 90.805677-121.690839 155.697549-78.435097l3.385806 2.361807 1.701162 1.288258 349.233548 280.295226c49.862194 36.797935 51.92671 108.296258 3.831742 148.26529l-2.77471 2.147097-351.364129 281.930322c-63.966968 47.186581-155.648-11.148387-159.611871-88.724645l-0.099097-4.062968v-82.861419l-10.652903 1.040516-11.115355 1.255226-13.60929 1.783742-15.293935 2.34529-14.203871 2.526968-9.612388 1.899355-12.387096 2.725161c-75.742968 17.589677-149.322323 67.303226-178.588904 124.300387l-3.633548 7.38271C126.728258 895.603613 49.548387 874.017032 49.548387 810.165677c0-32.98271 2.807742-66.328774 8.439742-99.575742l2.427871-13.262451 2.642581-12.882581C102.234839 504.303484 229.409032 374.139871 418.254452 338.481548l7.382709-1.32129z m116.620387-131.154581c-21.966452-12.254968-50.539355 2.378323-50.539354 24.955871v134.738581a33.032258 33.032258 0 0 1-29.117936 32.784516C282.32671 420.05471 163.427097 533.834323 127.686194 698.136774l-2.411355 11.759484-2.213162 12.139355a529.176774 529.176774 0 0 0-6.276129 53.330581c44.378839-63.983484 124.498581-113.812645 207.409549-133.070452l17.573161-3.79871 9.232516-1.783742 13.146839-2.312258 16.962064-2.593032 14.814968-1.948903 12.155871-1.370839 11.776-1.156129 11.363097-0.924903 10.96671-0.759742 14.748903-0.792774a33.032258 33.032258 0 0 1 34.799484 32.999225l-0.033033 117.314065 0.049549 2.378323c1.453419 28.37471 36.963097 50.952258 53.347097 38.912L895.669677 535.089548l2.312258-1.800258c13.724903-11.396129 13.824-30.521806-0.478967-42.79329L545.924129 208.334452l-1.486452-1.057033-2.180129-1.32129z" p-id="11682">
                      </path>
                    </svg>
                  </button>
                </Tooltip>
              </div>
            }
          </div>
        )}
        {
          msg.isBot && isExpanded &&
          <div className='messageFoldWrap'>
            <div className='foldMask'></div>
            <div className='foldIcon'>
              <img src={FoldArrowIcon} alt="展开内容" style={{ width: '12px', height: '12px' }} onClick={() => { setIsExpanded(false) }} />
            </div>
          </div>
        }
      </div>
    </div>
  )
}

export default MessageItem
