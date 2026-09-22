import { languageHeaders } from '@/app/i18n';
import { useEffect, useMemo, useState } from 'react'
import { ModelListResponse, ModelOption, supportsDeepThinking, supportsImageUnderstanding as modelSupportsImageUnderstanding } from '@/shared/types/model'
import { Conversation } from '@/shared/utils/localMessages'
import { DEFAULT_MODEL_ID, MODEL_STORAGE_KEY } from '../constants'
import { getModelsApiUrl } from '../utils'

interface UseChatModelsOptions {
  chatApiUrl: string;
  selectedConversation: Conversation | null;
  isLoading: boolean;
  defaultDescription: string;
}

export const useChatModels = ({
  chatApiUrl,
  selectedConversation,
  isLoading,
  defaultDescription
}: UseChatModelsOptions) => {
  const [revision, setRevision] = useState(0);
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener('models-changed', refresh); return () => window.removeEventListener('models-changed', refresh); }, []);
  const [models, setModels] = useState<ModelOption[]>([])
  const [isModelsLoading, setIsModelsLoading] = useState(false)
  const [thinkingPreference, setThinkingPreference] = useState(true)
  const [selectedModelId, setSelectedModelId] = useState<string>(
    localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL_ID
  )

  useEffect(() => {
    const controller = new AbortController();
    const fetchModels = async () => {
      setIsModelsLoading(true)
      try {
        const response = await fetch(getModelsApiUrl(chatApiUrl), {
          method: 'GET', signal: controller.signal,
          headers: { ...languageHeaders(),
            Accept: 'application/json'
          }
        })
        if (!response.ok) {
          throw new Error(`failed to fetch models, status: ${response.status}`)
        }
        const result: ModelListResponse = await response.json()
        if (controller.signal.aborted) return;
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
        if (controller.signal.aborted) return;
        console.log(error)
        setModels([
          {
            id: DEFAULT_MODEL_ID,
            name: 'DeepSeek Reasoner',
            provider: 'deepseek',
            description: defaultDescription,
            supportsStream: true,
            supportsThinking: true,
            supportsFileUpload: false,
            enabled: true
          }
        ])
        setSelectedModelId(DEFAULT_MODEL_ID)
        localStorage.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL_ID)
      } finally {
        if (!controller.signal.aborted) setIsModelsLoading(false)
      }
    }

    void fetchModels()
    return () => controller.abort();
  }, [chatApiUrl, defaultDescription, revision])

  useEffect(() => {
    if (!selectedConversation?.modelId || selectedConversation.modelId === selectedModelId) return
    setSelectedModelId(selectedConversation.modelId)
    localStorage.setItem(MODEL_STORAGE_KEY, selectedConversation.modelId)
  }, [selectedConversation?.modelId, selectedModelId])

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || null,
    [models, selectedModelId]
  )
  const selectedModelName = selectedModel?.name || selectedConversation?.modelName || selectedModelId || 'AI Assistant'
  const supportsImageUnderstanding = useMemo(() => modelSupportsImageUnderstanding(selectedModel), [selectedModel])
  const modelSupportsThinking = useMemo(() => supportsDeepThinking(selectedModel), [selectedModel])
  const supportsFileUpload = Boolean(selectedModel?.supportsFileUpload || supportsImageUnderstanding)
  const isThinkingEnabled = modelSupportsThinking && thinkingPreference

  const onToggleThinking = () => {
    if (!modelSupportsThinking || isLoading) return
    setThinkingPreference((prev) => !prev)
  }

  return {
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
  }
}
