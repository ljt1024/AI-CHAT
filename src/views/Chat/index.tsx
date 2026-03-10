import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatHeaderOperate from '@/components/ChatHeaderOperate';
import MessageItem from '@/components/MessageItem';
import Sidebar from '@/components/Sidebar';
import Share from '@/components/Share';
//@ts-ignore
import ChatInputControl, { UploadedFileItem } from '@/components/ChatInputControl';
import ArrowDownIcon from '@/assets/arrowDown.svg?react';
import { MessagePopProvider } from '@/components/MessagePop'
import { useChat, useChatDispatch } from '@/context/ChatContext';
import { newChat, storageMessages, removeLastAssistantMessage, Message, MessageAttachment, getSelectId, getMessageByCovId } from '@/utils/localMessages'
import { ModelListResponse, ModelOption } from '@/types/model';

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

interface FileUploadResponse {
  code?: number;
  data?: {
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    createdAt?: string;
    url?: string;
    ossUrl?: string;
    fileUrl?: string;
  };
  msg?: string;
}

type RequestMessageContent =
  | string
  | Array<
    | {
      type: 'image_url';
      image_url: {
        url: string;
      };
    }
    | {
      type: 'text';
      text: string;
    }
  >

interface RequestMessage {
  role: 'user' | 'assistant';
  content: RequestMessageContent;
}

let controller: AbortController | null = null
let signal: AbortSignal | null = null
function initAbortController() {
  controller = new AbortController();
  signal = controller.signal;
}
initAbortController()

const MODEL_STORAGE_KEY = 'selectedModelId'
const DEFAULT_MODEL_ID = 'deepseek-reasoner'

const getModelsApiUrl = (chatApiUrl: string): string => {
  if (chatApiUrl && /^https?:\/\//.test(chatApiUrl)) {
    return new URL('/api/models', chatApiUrl).toString()
  }
  return '/api/models'
}

const getFileUploadApiUrl = (chatApiUrl: string): string => {
  if (chatApiUrl && /^https?:\/\//.test(chatApiUrl)) {
    return new URL('/api/files/upload', chatApiUrl).toString()
  }
  return '/api/files/upload'
}

const getUploadedFileUrl = (fileData?: FileUploadResponse['data']): string | undefined => {
  if (!fileData) return undefined
  return fileData.ossUrl || fileData.url || fileData.fileUrl
}

const isImageAttachment = (attachment?: MessageAttachment): boolean => Boolean(
  attachment?.url && attachment.mimeType?.startsWith('image/')
)

const getModelCapabilities = (model: ModelOption | null): string[] => {
  const source = model?.inputModalities || model?.modalities || model?.capabilities || []
  return Array.isArray(source) ? source.map((item) => String(item).toLowerCase()) : []
}

const ChatAI: React.FC = () => {
  const chatApiUrl = ((import.meta as any).env.VITE_CHAT_BASE_URL || '') as string
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShowScrollBtn, setIsShowScrollBtn] = useState(false)
  const [isShowShare, setIsShowShare] = useState(false)
  const [shareTargetElement, setShareTargetElement] = useState<HTMLElement | null>(null)
  const [models, setModels] = useState<ModelOption[]>([])
  const [isModelsLoading, setIsModelsLoading] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>(
    localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL_ID
  )
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
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
  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || null,
    [models, selectedModelId]
  )
  const selectedModelName = selectedModel?.name || selectedConversation?.modelName || selectedModelId || 'AI Assistant'
  const supportsImageUnderstanding = useMemo(() => {
    const capabilities = getModelCapabilities(selectedModel)
    return Boolean(
      selectedModel?.supportsVision
      || selectedModel?.supportsImageUnderstanding
      || selectedModel?.supportsImageUrl
      || capabilities.includes('image')
      || capabilities.includes('vision')
    )
  }, [selectedModel])
  const supportsFileUpload = Boolean(selectedModel?.supportsFileUpload || supportsImageUnderstanding)

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

  useEffect(() => {
    const fetchModels = async () => {
      setIsModelsLoading(true)
      try {
        const response = await fetch(getModelsApiUrl(chatApiUrl), {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        })
        if (!response.ok) {
          throw new Error(`failed to fetch models, status: ${response.status}`)
        }
        const result: ModelListResponse = await response.json()
        const modelList = Array.isArray(result.data) ? result.data : []
        setModels(modelList)

        if (modelList.length > 0) {
          const enabledList = modelList.filter((model) => model.enabled)
          const availableList = enabledList.length > 0 ? enabledList : modelList
          const cachedModelId = localStorage.getItem(MODEL_STORAGE_KEY)
          const matchedModel = availableList.find((model) => model.id === cachedModelId)
            || availableList.find((model) => model.id === DEFAULT_MODEL_ID)
            || availableList[0]
          if (matchedModel) {
            setSelectedModelId(matchedModel.id)
            localStorage.setItem(MODEL_STORAGE_KEY, matchedModel.id)
          }
        }
      } catch (error) {
        console.log(error)
        setModels([
          {
            id: DEFAULT_MODEL_ID,
            name: 'DeepSeek Reasoner',
            provider: 'deepseek',
            description: '默认推理模型',
            supportsStream: true,
            supportsFileUpload: false,
            enabled: true
          }
        ])
        setSelectedModelId(DEFAULT_MODEL_ID)
        localStorage.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL_ID)
      } finally {
        setIsModelsLoading(false)
      }
    }

    fetchModels()
  }, [chatApiUrl])

  useEffect(() => {
    if (!selectedConversation?.modelId || selectedConversation.modelId === selectedModelId) return
    setSelectedModelId(selectedConversation.modelId)
    localStorage.setItem(MODEL_STORAGE_KEY, selectedConversation.modelId)
  }, [selectedConversation?.modelId, selectedModelId])

  useEffect(() => {
    if (!supportsFileUpload && uploadedFiles.length > 0) {
      setUploadedFiles([])
    }
  }, [supportsFileUpload, uploadedFiles.length])

  useEffect(() => {
    if (isWelcomeConversation || messages.length === 0) {
      setIsShowScrollBtn(false)
    }
  }, [isWelcomeConversation, messages.length])

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
      const firstAttachment = userMessage.attachments?.[0]
      const requestMode = userMessage.attachmentRequestType
        || (supportsImageUnderstanding && isImageAttachment(firstAttachment) ? 'image_url' : undefined)
        || (firstAttachment?.fileId ? 'file_id' : undefined)
      const requestMessage: RequestMessage = requestMode === 'image_url' && firstAttachment?.url
        ? {
          role: userMessage.role,
          content: [
            {
              type: 'image_url',
              image_url: {
                url: firstAttachment.url
              }
            },
            {
              type: 'text',
              text: userMessage.content
            }
          ]
        }
        : {
          role: userMessage.role,
          content: userMessage.content
        }
      const requestBody: Record<string, any> = {
        messages: [requestMessage],
        "model": selectedModelId,
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
      }
      if (requestMode === 'file_id' && firstAttachment?.fileId) {
        requestBody.fileId = firstAttachment.fileId
      }

      const response = await fetch(chatApiUrl, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: "text/event-stream", Authentication: 'bearer' },
        body: JSON.stringify(requestBody),
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
      storageMessages(assistantMessage, currentConversationModel)
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

  const onUploadFile = async (file: File) => {
    if (!supportsFileUpload || isUploadingFile || isLoading) return
    setIsUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('model', selectedModelId)

      const response = await fetch(getFileUploadApiUrl(chatApiUrl), {
        method: 'POST',
        body: formData
      })
      if (!response.ok) {
        throw new Error(`file upload failed, status: ${response.status}`)
      }
      const result: FileUploadResponse = await response.json()
      const fileData = result.data || {}
      const uploadedFile: UploadedFileItem = {
        fileId: `${Date.now()}-${file.name}`,
        serverFileId: fileData.fileId,
        url: getUploadedFileUrl(fileData),
        name: fileData.fileName || file.name,
        mimeType: fileData.mimeType || file.type,
        size: fileData.size || file.size
      }
      setUploadedFiles([uploadedFile])
    } catch (error) {
      console.log(error)
    } finally {
      setIsUploadingFile(false)
    }
  }

  const onRemoveUploadedFile = (uploadedFileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.fileId !== uploadedFileId))
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
                <p className="new-conversation-subtitle">你的AI问答助手</p>
                <ChatInputControl
                  variant="welcome"
                  inputText={inputText}
                  isLoading={isLoading}
                  supportsFileUpload={supportsFileUpload}
                  uploadedFiles={uploadedFiles}
                  isUploadingFile={isUploadingFile}
                  onUploadFile={onUploadFile}
                  onRemoveUploadedFile={onRemoveUploadedFile}
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
              uploadedFiles={uploadedFiles}
              isUploadingFile={isUploadingFile}
              onUploadFile={onUploadFile}
              onRemoveUploadedFile={onRemoveUploadedFile}
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
