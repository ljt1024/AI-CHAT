export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  supportsStream?: boolean;
  supportsFileUpload?: boolean;
  enabled?: boolean;
}

export interface ModelListResponse {
  code?: number;
  data?: ModelOption[];
  msg?: string;
}
