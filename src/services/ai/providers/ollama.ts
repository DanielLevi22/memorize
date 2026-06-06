import type { AIService, AIContentRequest } from '../types';

export class OllamaProvider implements AIService {
  private apiUrl: string;
  private model: string;

  constructor(
    apiUrl: string = 'http://localhost:11434',
    model: string = 'llama3.2'
  ) {
    this.apiUrl = apiUrl;
    this.model = model;
  }

  async generateContent(request: AIContentRequest): Promise<string> {
    if (request.audio) {
      throw new Error('O Ollama local não suporta análise de áudio diretamente. Altere para o Gemini nas Configurações.');
    }

    const cleanUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    const url = `${cleanUrl}/api/chat`;

    // Map messages history to Ollama's chat format
    const ollamaMessages: any[] = [];

    // Prepend system instruction if provided
    if (request.systemPrompt) {
      ollamaMessages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    // Append regular messages
    request.messages.forEach((m) => {
      const msg: any = {
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      };

      // Ollama expects images to be attached to the message containing them (usually the user message)
      if (m.role === 'user' && request.images && request.images.length > 0) {
        msg.images = request.images.map((img) => {
          // Clean base64 data to remove data:image/*;base64, header if present
          return img.data.includes(';base64,')
            ? img.data.split(';base64,')[1]
            : img.data;
        });
      }

      ollamaMessages.push(msg);
    });

    const body: any = {
      model: request.model || this.model,
      messages: ollamaMessages,
      stream: false,
    };

    // If JSON is requested, specify the format
    if (request.responseMimeType === 'application/json') {
      body.format = 'json';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Erro do servidor Ollama (código ${response.status}): ${errorText || response.statusText}`);
      }

      const result = await response.json();
      const content = result.message?.content;

      if (content === undefined || content === null) {
        throw new Error('Ollama respondeu com sucesso, mas o campo message.content está vazio.');
      }

      return content;
    } catch (err: any) {
      // Improve network error feedback (e.g. if Ollama is not running or CORS is blocked)
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error(
          'Não foi possível conectar ao Ollama local. Certifique-se de que:\n' +
          '1. O Ollama está rodando no seu computador.\n' +
          '2. Você iniciou o Ollama com CORS habilitado (OLLAMA_ORIGINS="*" no terminal).\n' +
          `Tentativa de conexão falhou para: ${url}`
        );
      }
      throw err;
    }
  }
}
