import React, { useState, useEffect, useRef } from 'react';
import ChatHeaderOperate from '@/components/ChatHeaderOperate';
import MessageItem from '@/components/MessageItem';
import Sidebar from '@/components/Sidebar';
import Share from '@/components/Share';
//@ts-ignore
import ChatInputControl from '@/components/ChatInputControl';
import ArrowDownIcon from '@/assets/arrowDown.svg?react';
import { MessagePopProvider } from '@/components/MessagePop'
import { useChat, useChatDispatch } from '@/context/ChatContext';
import { newChat, storageMessages, removeLastAssistantMessage, Message } from '@/utils/localMessages'

import './chat.css';

interface SSEData {
  choices: Array<{
    delta: {
      content: string | null;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

let controller: AbortController | null = null
let signal: AbortSignal | null = null
function initAbortController() {
  controller = new AbortController();
  signal = controller.signal;
}
initAbortController()

const ChatAI: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShowScrollBtn, setIsShowScrollBtn] = useState(false)
  const [isShowShare, setIsShowShare] = useState(false)
  const [shareTargetElement, setShareTargetElement] = useState<HTMLElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { messages } = useChat()
  const dispatch = useChatDispatch()
  const isNewConversation = messages.length === 0 && localStorage.getItem('isNewCov') === 'true'

  const handleInputChange = (value: string) => {
    setInputText(value);
  }

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({});
  };

  useEffect(() => {
    dispatch({type: 'getLastMessages'})
    const showSrollBtnHeight = 200
    const messagesRefCurrent = messagesRef.current
    if (messagesRefCurrent) {
      messagesRefCurrent.addEventListener('scroll', () => {
        const bottomHeight = messagesRefCurrent.scrollHeight - messagesRefCurrent.scrollTop - messagesRefCurrent.clientHeight
        setIsShowScrollBtn(bottomHeight >= showSrollBtnHeight)
      })

      return () => {
        messagesRefCurrent.removeEventListener('scroll', () => {})
      }
    }
  }, [])

  // 检测主动滚动事件，需要停止滑动到最底部行为
  window.addEventListener('scroll', ()=> {
    console.log('滚动了')
  })

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const getLoadingMessage = (): Message => ({
    content: '思考中...',
    reasoning_content: '',
    isBot: true,
    timestamp: new Date().toISOString(),
    isLoading: true,
    role: 'assistant'
  })

  const requestAssistantReply = async (userMessage: Message, appendUserMessage: boolean) => {
    let assistantMessage = getLoadingMessage()

    if (appendUserMessage) {
      storageMessages(userMessage)
      dispatch({
        type: 'addMessages',
        messages: [userMessage, assistantMessage]
      } as any)
    } else {
      dispatch({
        type: 'addMessages',
        messages: [assistantMessage]
      } as any)
    }

    setIsLoading(true);

    try {
      const response = await fetch((import.meta as any).env.VITE_CHAT_BASE_URL, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: "text/event-stream", Authentication: 'bearer' },
        body: JSON.stringify({
          messages: [userMessage],
          "model": "deepseek-reasoner",
          "frequency_penalty": 0,
          "max_tokens": 2048,
          "presence_penalty": 0,
          "response_format": {
            "type": "text"
          },
          "stop": null,
          "stream": true,
          "stream_options": null,
          "temperature": 1,
          "top_p": 1,
          "tools": null,
          "tool_choice": "none",
          "logprobs": false,
          "top_logprobs": null
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      assistantMessage = {
        content: '',
        reasoning_content: '',
        isBot: true,
        timestamp: new Date().toISOString(),
        usage: undefined,
        isLoading: true,
        role: 'assistant'
      }

      let flag = false
      const parseSSEEvent = (event: string) => {
        const lines = event;
        try {
          let str = lines.split(": ")[1]
          // sse最终以'data: [DONE]'结束
          if (str === '[DONE]') {
            assistantMessage.isLoading = false
            dispatch({
              type: 'addMessages',
              messages: assistantMessage
            } as any)
            return
          }
          let data: SSEData = JSON.parse(str);
          if (data.usage) {
            assistantMessage.usage = data.usage
          }

          // 正式回复内容
          if (data.choices[0].delta.content !== null) {
            if (flag) {
              assistantMessage.content += '\n\n'
            }
            assistantMessage.content += data.choices[0].delta.content || ''
            dispatch({
              type: 'addMessages',
              messages: assistantMessage
            } as any)
            flag = false
            // 思考内容
          } else {
            flag = true
            assistantMessage.reasoning_content += data.choices[0].delta.reasoning_content || ''
            dispatch({
              type: 'addMessages',
              messages: assistantMessage
            } as any)
          }
        } catch (error) {
          console.log(error)
        }
      }

      // 持续读取流数据
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            reader.releaseLock();
            break;
          }
          const chunk = decoder.decode(value);
          // SSE 事件以双换行分隔
          const events = chunk.split("\n\n");
          for (const event of events) {
            if (event.trim() === "") continue;
            parseSSEEvent(event);
          }
        }
      }
      storageMessages(assistantMessage)
    } catch (error: any) {
      console.log(error)
      if (error.name === "AbortError") {
        console.log('请求被中断')
      } else {
        dispatch({
          type: 'addMessages',
          messages: {
            content: '⚠️ 服务器繁忙, 请稍后再试！',
            isBot: true,
            isError: true
          }
        } as any)
      }
    } finally {
      scrollToBottom()
      setIsLoading(false);
      // 更新会话列表
      dispatch({
        type: 'getCovList'
      } as any)
      localStorage.setItem('isNewCov', 'false')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    // TODO 增加message id取代key
    const newMessage: Message = {
      content: inputText,
      role: 'user',
      timestamp: new Date().toISOString(),
      isBot: false
    };

    if (messages.length === 0) {
      newChat()
    }
    localStorage.setItem('isNewCov', 'false')
    setInputText('');

    await requestAssistantReply(newMessage, true)
  };

  const handleRetryLastAnswer = async () => {
    if (isLoading || messages.length < 2) return
    const lastMessage = messages[messages.length - 1]
    const lastUserMessage = messages[messages.length - 2]

    if (!lastMessage?.isBot || lastMessage.isLoading || !lastUserMessage || lastUserMessage.isBot) {
      return
    }

    dispatch({
      type: 'removeLastMessage'
    } as any)
    removeLastAssistantMessage()
    setIsShowShare(false)
    setShareTargetElement(null)
    localStorage.setItem('isNewCov', 'false')

    await requestAssistantReply(lastUserMessage, false)
  }

  const onStopSSE = () => {
    console.log('停止请求')
    controller?.abort();
    initAbortController()
  }


  return (
    <MessagePopProvider>
      <div className="chat-container">
        <Sidebar
          isLoading={isLoading}
        />
        {/* {isShowShare && <div className='shareCancel' onClick={() => setIsShowShare(false)}>取消分享</div>}
        {!isShowShare && <ThemeSwitcher />} */}
        <div className='messages-content'>
          <ChatHeaderOperate isShowShare={isShowShare} onCancelShare={setIsShowShare} />
          <div className='messages-scollWrap' ref={messagesRef}>
            {isNewConversation ? (
              <div className="new-conversation-panel">
                <h1 className="new-conversation-title">AICHAT</h1>
                <p className="new-conversation-subtitle">你的AI问答助手</p>
                <ChatInputControl
                  variant="welcome"
                  inputText={inputText}
                  isLoading={isLoading}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmit}
                  onStopSSE={onStopSSE}
                />
              </div>
            ) : (
              <div className="messages-wrap">
                {messages.map((msg: Message, index: number) => (
                  <MessageItem
                    msg={msg}
                    key={index}
                    setIsShowShare={setIsShowShare}
                    setShareTarget={setShareTargetElement}
                    canRetry={msg.isBot && !msg.isLoading && index === messages.length - 1 && !isLoading}
                    onRetry={handleRetryLastAnswer}
                  />
                ))}
                {isLoading && (
                  <div className="typing-indicator">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {
            isShowShare && <Share targetElement={shareTargetElement} setIsShowShare={setIsShowShare}/>
          }

          {!isNewConversation && (
            <ChatInputControl
              inputText={inputText}
              isLoading={isLoading}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              onStopSSE={onStopSSE}
            />
          )}

          {isShowScrollBtn &&
            <div className="chatScrollBottom" onClick={() => {
              scrollToBottom()
            }}>
              <ArrowDownIcon className="chatScrollBottomIcon" />
            </div>}
        </div>
      </div>
    </MessagePopProvider>
  );
};

export default ChatAI;
