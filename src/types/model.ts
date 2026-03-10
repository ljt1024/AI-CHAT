export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  supportsStream?: boolean;
  supportsFileUpload?: boolean;
  supportsVision?: boolean;
  supportsImageUnderstanding?: boolean;
  supportsImageUrl?: boolean;
  modalities?: string[];
  inputModalities?: string[];
  capabilities?: string[];
  enabled?: boolean;
}

export interface ModelListResponse {
  code?: number;
  data?: ModelOption[];
  msg?: string;
}
