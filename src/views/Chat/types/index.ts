export interface SSEData {
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

export interface FileUploadResponse {
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

export type RequestMessageContent =
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

export interface RequestMessage {
  role: 'user' | 'assistant';
  content: RequestMessageContent;
}
