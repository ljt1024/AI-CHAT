import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatHeaderOperate from '@/shared/components/ChatHeaderOperate';
import MessageItem from '@/shared/components/MessageItem';
import Sidebar from '@/shared/components/Sidebar';
import Share from '@/shared/components/Share';
import ChatInputControl from '@/shared/components/ChatInputControl';
import ArrowDownIcon from '@/shared/assets/arrowDown.svg?react';
import { MessagePopProvider } from '@/shared/components/MessagePop'
import { useChat, useChatDispatch } from '@/app/providers/ChatContext';
import { useLanguage } from '@/app/providers/LanguageContext';
import { newChat, storageMessages, ensureAgentTurnId, removeLastAssistantMessage, Message, getSelectId, getMessageByCovId } from '@/shared/utils/localMessages'
import { MODEL_STORAGE_KEY } from './constants';
import { SSEData } from './types';
import { useChatModels } from './hooks/useChatModels';
import { useFileUpload } from './hooks/useFileUpload';
import { streamAgents } from '@/features/agents/api';
import type { AgentArtifact } from '@/features/agents/types';
import { ArtifactPreviewPanel } from '@/features/agents/components/ArtifactPreviewPanel';
import {
  buildContextMessages,
  cloneMessage,
  isImageAttachment,
  toRequestMessage
} from './utils';

import './chat.css';

const ChatAI: React.FC = () => {
  const controllerRef = useRef<AbortController | null>(null);
  const chatApiUrl = ((import.meta as any).env.VITE_CHAT_BASE_URL || '') as string
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(() => localStorage.getItem('chat.agentMode') === 'true');
  const [liveFiles, setLiveFiles] = useState<{ sessionId: string; files: AgentArtifact[] }>({ sessionId: '', files: [] });
  const [previewSelection, setPreviewSelection] = useState<{ sessionId: string; artifact: AgentArtifact } | null>(null);
  const setPreviewArtifact = (artifact: AgentArtifact) => setPreviewSelection({ sessionId: getSelectId() || '', artifact });
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
  const previewArtifact = previewSelection?.sessionId === getSelectId() && messages.length ? previewSelection.artifact : null
  const previewArtifacts = [...messages.flatMap(message => message.artifacts || []), ...(liveFiles.sessionId === getSelectId() ? liveFiles.files : [])]
  if (previewArtifact && !previewArtifacts.some(file => file.fileId === previewArtifact.fileId)) previewArtifacts.push(previewArtifact)
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
      controllerRef.current?.abort();
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
    const requestController = new AbortController();
    controllerRef.current = requestController;

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
        signal: requestController.signal,
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
            content: `${t('chat.serverBusy')}\n\n${error instanceof Error ? error.message : '请求失败，请检查后端服务是否启动'}`,
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

  const requestAgentReply = async (userMessage: Message, appendUser: boolean) => {
    const sessionId = getSelectId()
    if (!sessionId) return
    const turnId = ensureAgentTurnId(userMessage)
    userMessage = { ...userMessage, agentTurnId: turnId }
    const model = { id: selectedModelId, name: selectedModelName }
    const seenPreviews = new Set<string>();
    setLiveFiles({ sessionId, files: [] });
    const requestController = new AbortController()
    controllerRef.current = requestController
    setIsLoading(true)
    let assistant: Message = {
      content: '', role: 'assistant', isBot: true, timestamp: new Date().toISOString(),
      isLoading: true, agentStatus: 'running', agentSteps: [], memoryMessages: 0, agentTurnId: turnId, artifacts: [],
    }
    if (appendUser) storageMessages(userMessage, model)
    dispatch({ type: 'addMessages', messages: appendUser ? [userMessage, assistant] : [assistant] })
    const render = () => {
      streamPendingMessageRef.current = { ...assistant, agentSteps: [...(assistant.agentSteps || [])] }
      scheduleStreamRender()
    }
    try {
      await streamAgents({ input: userMessage.content, model: selectedModelId, sessionId, turnId }, (event) => {
        if (event.type === 'start') assistant.memoryMessages = event.memoryMessages
        if (event.type === 'memory') assistant.summarizedMessages = event.summarizedMessages
        if (event.type === 'preview') {
          const draft = event.preview;
          const first = !seenPreviews.has(draft.id);
          seenPreviews.add(draft.id);
          const file: AgentArtifact = {
            fileId: `draft:${draft.id}`, toolCallId: draft.toolCallId, format: draft.format, draft,
            fileName: `${draft.title || '正在生成'}.${draft.format}`, mimeType: '', size: 0, downloadPath: '', createdAt: '',
          };
          setLiveFiles(previous => ({ sessionId, files: [...(previous.sessionId === sessionId ? previous.files : []).filter(item => item.fileId !== file.fileId), file] }));
          setPreviewSelection(previous => first || (previous?.sessionId === sessionId && previous.artifact.fileId === file.fileId) ? { sessionId, artifact: file } : previous);
        }
        if (event.type === 'artifact') {
          assistant.artifacts = [...(assistant.artifacts || []).filter((file) => file.fileId !== event.artifact.fileId), event.artifact]
          setLiveFiles(previous => ({ ...previous, files: previous.files.filter(file => !event.artifact.toolCallId || file.toolCallId !== event.artifact.toolCallId) }));
          setPreviewSelection(previous => (previous?.sessionId === sessionId && previous.artifact.toolCallId === event.artifact.toolCallId) || seenPreviews.size === 0 ? { sessionId, artifact: event.artifact } : previous);
        }
        if (event.type === 'answer_start') assistant.content = ''
        if (event.type === 'delta') assistant.content += event.text
        if (event.type === 'step_delta') {
          assistant.agentSteps = assistant.agentSteps?.map((step) => step.id === event.stepId
            ? { ...step, output: (event.reset ? '' : step.output) + event.text }
            : step)
        }
        if (event.type === 'step') {
          const steps = assistant.agentSteps || []
          assistant.agentSteps = steps.some((step) => step.id === event.step.id)
            ? steps.map((step) => step.id === event.step.id ? event.step : step)
            : [...steps, event.step]
        }
        if (event.type === 'done') {
          assistant.content = event.result.output
          assistant.agentSteps = event.result.steps
          assistant.agentStatus = 'completed'
          assistant.artifacts = event.result.artifacts || assistant.artifacts
        }
        render()
      }, requestController.signal)
    } catch (error) {
      const stopped = requestController.signal.aborted
      assistant.agentStatus = stopped ? 'cancelled' : 'failed'
      assistant.isError = !stopped
      assistant.content += `\n\n${stopped ? '已停止，本轮未写入会话记忆。' : error instanceof Error ? error.message : '智能体执行失败'}`
      assistant.agentSteps = assistant.agentSteps?.map((step) => step.status === 'running' ? { ...step, status: stopped ? 'cancelled' : 'failed' } : step)
    } finally {
      const finishDraft = (file: AgentArtifact): AgentArtifact => file.draft && ['generating', 'saving'].includes(file.draft.status)
        ? { ...file, draft: { ...file.draft, status: requestController.signal.aborted ? 'cancelled' : 'failed' } } : file;
      setLiveFiles(previous => previous.sessionId === sessionId ? { ...previous, files: previous.files.map(finishDraft) } : previous);
      setPreviewSelection(previous => previous?.sessionId === sessionId ? { ...previous, artifact: finishDraft(previous.artifact) } : previous);
      assistant = { ...assistant, isLoading: false }
      cancelStreamRender()
      streamPendingMessageRef.current = null
      dispatch({ type: 'addMessages', messages: assistant })
      storageMessages(assistant, model)
      setIsLoading(false)
      setUploadedFiles([])
      dispatch({ type: 'getCovList' })
      if (controllerRef.current === requestController) controllerRef.current = null
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

    if (isAgentMode) {
      await requestAgentReply(newMessage, true)
      return
    }
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

    if (lastMessage.agentStatus) await requestAgentReply(lastUserMessage, false)
    else await requestAssistantReply(lastUserMessage, false, messages.slice(0, -2))
  }

  const onStopSSE = () => {
    controllerRef.current?.abort();
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
      <div className={`chat-container${previewArtifact ? ' chat-container--preview' : ''}`}>
        <Sidebar
          isLoading={isLoading}
        />
        <div className="chat-workspace">
          <ChatHeaderOperate
            isShowShare={isShowShare}
            onCancelShare={setIsShowShare}
            models={models}
            selectedModelId={selectedModel?.id || selectedModelId}
            isModelLoading={isModelsLoading || isLoading}
            onSelectModel={onSelectModel}
          />
          <div className="chat-panels">
            <div className='messages-content'>
              <div className='messages-scollWrap' ref={messagesRef}>
                {isWelcomeConversation ? (
                  <div className="new-conversation-panel">
                    <h1 className="new-conversation-title">AICHAT</h1>
                    <p className="new-conversation-subtitle">{t('chat.subtitle')}</p>
                    <ChatInputControl
                      variant="welcome"
                      inputText={inputText}
                      isLoading={isLoading}
                      supportsFileUpload={supportsFileUpload && !isAgentMode}
                      imageOnlyUpload={supportsImageUnderstanding}
                      supportsThinking={modelSupportsThinking && !isAgentMode}
                      isThinkingEnabled={isThinkingEnabled}
                      uploadedFiles={uploadedFiles}
                      isUploadingFile={isUploadingFile}
                      onUploadFile={onUploadFile}
                      onRemoveUploadedFile={onRemoveUploadedFile}
                      onToggleThinking={onToggleThinking}
                      isAgentMode={isAgentMode}
                      onToggleAgentMode={() => { const next = !isAgentMode; setIsAgentMode(next); localStorage.setItem('chat.agentMode', String(next)); setUploadedFiles([]); }}
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
                        onPreviewArtifact={setPreviewArtifact}
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
                  supportsFileUpload={supportsFileUpload && !isAgentMode}
                  imageOnlyUpload={supportsImageUnderstanding}
                  supportsThinking={modelSupportsThinking && !isAgentMode}
                  isThinkingEnabled={isThinkingEnabled}
                  uploadedFiles={uploadedFiles}
                  isUploadingFile={isUploadingFile}
                  onUploadFile={onUploadFile}
                  onRemoveUploadedFile={onRemoveUploadedFile}
                  onToggleThinking={onToggleThinking}
                  isAgentMode={isAgentMode}
                  onToggleAgentMode={() => { const next = !isAgentMode; setIsAgentMode(next); localStorage.setItem('chat.agentMode', String(next)); setUploadedFiles([]); }}
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
            {previewArtifact && <ArtifactPreviewPanel key={previewArtifact.toolCallId || previewArtifact.fileId} artifact={previewArtifact} artifacts={previewArtifacts} onSelect={setPreviewArtifact} onClose={() => setPreviewSelection(null)} />}
          </div>
        </div>
      </div>
    </MessagePopProvider>
  );
};

export default ChatAI;
