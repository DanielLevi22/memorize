export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIContentRequest {
  systemPrompt?: string;
  messages: ChatMessageParam[];
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: any;
  images?: {
    mimeType: string;
    data: string; // Clean Base64 string without data:image/*;base64, prefix
  }[];
  audio?: {
    mimeType: string;
    data: string; // Clean Base64 string without prefix
  };
  model?: string;
}

export interface AIService {
  generateContent(request: AIContentRequest): Promise<string>;
}
