import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatHeaderOperate from '@/components/ChatHeaderOperate';
import MessageItem from '@/components/MessageItem';
import Sidebar from '@/components/Sidebar';
import Share from '@/components/Share';
import ChatInputControl from '@/components/ChatInputControl';
import ArrowDownIcon from '@/assets/arrowDown.svg?react';
import { MessagePopProvider } from '@/components/MessagePop'
import { useChat, useChatDispatch } from '@/context/ChatContext';
import { useLanguage } from '@/context/LanguageContext';
import { newChat, storageMessages, removeLastAssistantMessage, Message, getSelectId, getMessageByCovId } from '@/utils/localMessages'
import { MODEL_STORAGE_KEY } from './constants';
import { SSEData } from './types';
import { useChatModels } from './hooks/useChatModels';
import { useFileUpload } from './hooks/useFileUpload';
import {
  buildContextMessages,
  cloneMessage,
  isImageAttachment,
  toRequestMessage
} from './utils';

import './chat.css';

let controller: AbortController | null = null
let signal: AbortSignal | null = null
function initAbortController() {
  controller = new AbortController();
  signal = controller.signal;
}
initAbortController()


const ChatAI: React.FC = () => {
  const chatApiUrl = ((import.meta as any).env.VITE_CHAT_BASE_URL || '') as string
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShowScrollBtn, setIsShowScrollBtn] = useState(false)
  const [isShowShare, setIsShowShare] = useState(false)
  const [shareTargetElement, setShareTargetElement] = useState<HTMLElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const streamFrameRef = useRef<number | null>(null)
  const streamPendingMessageRef = useRef<Message | null>(null)
  const { t } = useLanguage()
  const { messages } = useChat()
  const dispatch = useChatDispatch()
  const isNewConversation = messages.length === 0 && localStorage.getItem('isNewCov') === 'true'
  const hasSelectedConversation = Boolean(getSelectId())
  const isWelcomeConversation = messages.length === 0 && (isNewConversation || !hasSelectedConversation)
  const selectedConversation = useMemo(() => {
    if (isNewConversation) return null
    const selectId = getSelectId()
    if (!selectId) return null
    return getMessageByCovId(selectId).curMessage
  }, [messages, isNewConversation])
  const {
    models,
    isModelsLoading,
    setSelectedModelId,
    selectedModel,
    selectedModelId,
    selectedModelName,
    supportsImageUnderstanding,
    modelSupportsThinking,
    supportsFileUpload,
    isThinkingEnabled,
    onToggleThinking
  } = useChatModels({
    chatApiUrl,
    selectedConversation,
    isLoading,
    defaultDescription: t('chat.defaultDescription')
  })
  const {
    uploadedFiles,
    isUploadingFile,
    setUploadedFiles,
    onUploadFile,
    onRemoveUploadedFile
  } = useFileUpload({
    chatApiUrl,
    selectedModelId,
    supportsFileUpload,
    supportsImageUnderstanding,
    isLoading
  })

  const handleInputChange = (value: string) => {
    setInputText(value);
  }

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({});
  };

  const cancelStreamRender = () => {
    if (streamFrameRef.current === null) return
    cancelAnimationFrame(streamFrameRef.current)
    streamFrameRef.current = null
  }

  const flushStreamRender = () => {
    cancelStreamRender()
    const pendingMessage = streamPendingMessageRef.current
    if (!pendingMessage) return
    dispatch({
      type: 'addMessages',
      messages: cloneMessage(pendingMessage)
    } as any)
  }

  const scheduleStreamRender = () => {
    if (streamFrameRef.current !== null) return
    streamFrameRef.current = requestAnimationFrame(() => {
      streamFrameRef.current = null
      const pendingMessage = streamPendingMessageRef.current
      if (!pendingMessage) return
      dispatch({
        type: 'addMessages',
        messages: cloneMessage(pendingMessage)
      } as any)
    })
  }

  useEffect(() => {
    dispatch({type: 'getLastMessages'})
    const showScrollBtnHeight = 200
    const messagesRefCurrent = messagesRef.current
    if (messagesRefCurrent) {
      const handleMessagesScroll = () => {
        const bottomHeight = messagesRefCurrent.scrollHeight - messagesRefCurrent.scrollTop - messagesRefCurrent.clientHeight
        setIsShowScrollBtn(bottomHeight >= showScrollBtnHeight)
      }

      messagesRefCurrent.addEventListener('scroll', handleMessagesScroll)

      return () => {
        messagesRefCurrent.removeEventListener('scroll', handleMessagesScroll)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (streamFrameRef.current !== null) {
        cancelAnimationFrame(streamFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isWelcomeConversation || messages.length === 0) {
      setIsShowScrollBtn(false)
    }
  }, [isWelcomeConversation, messages.length])

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const getLoadingMessage = (): Message => ({
    content: t('chat.loading'),
    reasoning_content: '',
    isBot: true,
    timestamp: new Date().toISOString(),
    isLoading: true,
    role: 'assistant'
  })

  const requestAssistantReply = async (
    userMessage: Message,
    appendUserMessage: boolean,
    historyMessages: Message[]
  ) => {
    let assistantMessage = getLoadingMessage()
    const currentConversationModel = {
      id: selectedModelId,
      name: selectedModelName
    }

    if (appendUserMessage) {
      storageMessages(userMessage, currentConversationModel)
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
      streamPendingMessageRef.current = null
      cancelStreamRender()
      const firstAttachment = userMessage.attachments?.[0]
      const requestMode = userMessage.attachmentRequestType
        || (supportsImageUnderstanding && isImageAttachment(firstAttachment) ? 'image_url' : undefined)
        || (firstAttachment?.fileId ? 'file_id' : undefined)
      const requestMessage = toRequestMessage(userMessage, {
        includeImageAttachments: requestMode === 'image_url',
        truncateContent: false
      }) || {
        role: userMessage.role,
        content: userMessage.content
      }
      const requestMessages = buildContextMessages(
        historyMessages,
        requestMessage,
        supportsImageUnderstanding
      )
      const requestBody: Record<string, any> = {
        messages: requestMessages,
        "model": selectedModelId,
        "thinking": isThinkingEnabled,
        "frequency_penalty": 0,
        "max_tokens": 2048 * 10,
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
      }
      if (requestMode === 'file_id' && firstAttachment?.fileId) {
        requestBody.fileIds = [firstAttachment.fileId]
        requestBody.fileId = firstAttachment.fileId
      }

      const response = await fetch(chatApiUrl, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: "text/event-stream", Authentication: 'bearer' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok || !response.body) {
        throw new Error(`chat request failed, status: ${response.status}`)
      }

      const reader = response.body.getReader();
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
      let streamBuffer = ''
      const scheduleAssistantRender = () => {
        streamPendingMessageRef.current = assistantMessage
        scheduleStreamRender()
      }
      const flushAssistantRender = () => {
        streamPendingMessageRef.current = assistantMessage
        flushStreamRender()
      }
      const parseSSEEvent = (event: string) => {
        const lines = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (!lines) return
        try {
          // sse最终以'data: [DONE]'结束
          if (lines === '[DONE]') {
            assistantMessage.isLoading = false
            flushAssistantRender()
            return
          }
          let data: SSEData = JSON.parse(lines);
          if (data.usage) {
            assistantMessage.usage = data.usage
          }

          // 正式回复内容
          if (data.choices[0].delta.content !== null && data.choices[0].delta.content !== undefined) {
            if (flag) {
              assistantMessage.content += '\n\n'
            }
            assistantMessage.content += data.choices[0].delta.content || ''
            scheduleAssistantRender()
            flag = false
            // 思考内容
          } else {
            flag = true
            assistantMessage.reasoning_content += data.choices[0].delta.reasoning_content || ''
            scheduleAssistantRender()
          }
        } catch (error) {
          console.log(error)
        }
      }

      // 持续读取流数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        streamBuffer += decoder.decode(value, { stream: true });
        streamBuffer = streamBuffer.replace(/\r\n/g, '\n')
        const events = streamBuffer.split("\n\n");
        streamBuffer = events.pop() || ''
        for (const event of events) {
          if (event.trim() === "") continue;
          parseSSEEvent(event);
        }
      }
      streamBuffer += decoder.decode()
      streamBuffer = streamBuffer.replace(/\r\n/g, '\n')
      if (streamBuffer.trim()) {
        parseSSEEvent(streamBuffer)
      }
      assistantMessage.isLoading = false
      flushAssistantRender()
      reader.releaseLock();
      storageMessages(cloneMessage(assistantMessage), currentConversationModel)
    } catch (error: any) {
      console.log(error)
      if (error.name === "AbortError") {
        if (streamPendingMessageRef.current) {
          assistantMessage.isLoading = false
          flushStreamRender()
        } else {
          cancelStreamRender()
        }
        console.log('请求被中断')
      } else {
        cancelStreamRender()
        streamPendingMessageRef.current = null
        dispatch({
          type: 'addMessages',
          messages: {
            content: t('chat.serverBusy'),
            isBot: true,
            isError: true
          }
        } as any)
      }
    } finally {
      scrollToBottom()
      setIsLoading(false);
      setUploadedFiles([])
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
      isBot: false,
      attachments: uploadedFiles.length > 0
        ? uploadedFiles.map((file) => ({
          fileId: file.serverFileId,
          url: file.url,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size
        }))
        : undefined,
      attachmentRequestType: (() => {
        const firstUploadedFile = uploadedFiles[0]
        if (!firstUploadedFile) return undefined
        if (supportsImageUnderstanding && firstUploadedFile.url && firstUploadedFile.mimeType?.startsWith('image/')) {
          return 'image_url'
        }
        if (firstUploadedFile.serverFileId) {
          return 'file_id'
        }
        return undefined
      })()
    };

    if (messages.length === 0) {
      newChat({
        id: selectedModelId,
        name: selectedModelName
      })
    }
    localStorage.setItem('isNewCov', 'false')
    setInputText('');

    await requestAssistantReply(newMessage, true, messages)
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

    await requestAssistantReply(lastUserMessage, false, messages.slice(0, -2))
  }

  const onStopSSE = () => {
    console.log('停止请求')
    controller?.abort();
    initAbortController()
  }

  const onSelectModel = (modelId: string) => {
    if (isLoading || isModelsLoading || modelId === selectedModelId) return
    const targetModel = models.find((model) => model.id === modelId)
    if (!targetModel || !targetModel.enabled) return

    setSelectedModelId(modelId)
    localStorage.setItem(MODEL_STORAGE_KEY, modelId)
    localStorage.setItem('isNewCov', 'true')
    dispatch({
      type: 'clearMessages'
    } as any)
    setInputText('')
    setUploadedFiles([])
    setIsShowShare(false)
    setShareTargetElement(null)
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
          <ChatHeaderOperate
            isShowShare={isShowShare}
            onCancelShare={setIsShowShare}
            models={models}
            selectedModelId={selectedModel?.id || selectedModelId}
            isModelLoading={isModelsLoading || isLoading}
            onSelectModel={onSelectModel}
          />
          <div className='messages-scollWrap' ref={messagesRef}>
            {isWelcomeConversation ? (
              <div className="new-conversation-panel">
                <h1 className="new-conversation-title">AICHAT</h1>
                <p className="new-conversation-subtitle">{t('chat.subtitle')}</p>
                <ChatInputControl
                  variant="welcome"
                  inputText={inputText}
                  isLoading={isLoading}
                  supportsFileUpload={supportsFileUpload}
                  imageOnlyUpload={supportsImageUnderstanding}
                  supportsThinking={modelSupportsThinking}
                  isThinkingEnabled={isThinkingEnabled}
                  uploadedFiles={uploadedFiles}
                  isUploadingFile={isUploadingFile}
                  onUploadFile={onUploadFile}
                  onRemoveUploadedFile={onRemoveUploadedFile}
                  onToggleThinking={onToggleThinking}
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
                    botName={selectedModelName}
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

          {!isWelcomeConversation && (
            <ChatInputControl
              inputText={inputText}
              isLoading={isLoading}
              supportsFileUpload={supportsFileUpload}
              imageOnlyUpload={supportsImageUnderstanding}
              supportsThinking={modelSupportsThinking}
              isThinkingEnabled={isThinkingEnabled}
              uploadedFiles={uploadedFiles}
              isUploadingFile={isUploadingFile}
              onUploadFile={onUploadFile}
              onRemoveUploadedFile={onRemoveUploadedFile}
              onToggleThinking={onToggleThinking}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              onStopSSE={onStopSSE}
            />
          )}

          {!isWelcomeConversation && isShowScrollBtn &&
            <div className="chatScrollBottom" onClick={() => {
              scrollToBottom()
              setIsShowScrollBtn(false)
            }}>
              <ArrowDownIcon className="chatScrollBottomIcon" />
            </div>}
        </div>
      </div>
    </MessagePopProvider>
  );
};

export default ChatAI;
