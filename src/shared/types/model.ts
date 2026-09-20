export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  supportsStream?: boolean;
  supportsFileUpload?: boolean;
  supportsThinking?: boolean;
  supportsVision?: boolean;
  supportsImageUnderstanding?: boolean;
  supportsImageUrl?: boolean;
  modalities?: string[];
  inputModalities?: string[];
  capabilities?: string[];
  enabled?: boolean;
}

export const getModelCapabilities = (model: ModelOption | null | undefined): string[] => {
  const source = model?.inputModalities || model?.modalities || model?.capabilities || []
  return Array.isArray(source) ? source.map((item) => String(item).toLowerCase()) : []
}

export const supportsImageUnderstanding = (model: ModelOption | null | undefined): boolean => {
  const capabilities = getModelCapabilities(model)
  return Boolean(
    model?.supportsVision
    || model?.supportsImageUnderstanding
    || model?.supportsImageUrl
    || capabilities.includes('image')
    || capabilities.includes('vision')
  )
}

export const supportsDeepThinking = (model: ModelOption | null | undefined): boolean => Boolean(
  model?.supportsThinking
)

export interface ModelListResponse {
  code?: number;
  data?: ModelOption[];
  msg?: string;
}
