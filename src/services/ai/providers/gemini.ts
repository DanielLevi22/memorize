import type { AIService, AIContentRequest } from '../types';

export class GeminiProvider implements AIService {
  private apiKey: string;
  private model: string;

  constructor(
    apiKey: string,
    model: string = 'gemini-2.5-flash'
  ) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent(request: AIContentRequest): Promise<string> {
    if (!this.apiKey.trim()) {
      throw new Error('Chave de API do Gemini não configurada nas configurações.');
    }

    const activeModel = request.model || this.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${this.apiKey}`;

    // Map context messages
    const contents = request.messages.map((m) => {
      const parts: any[] = [];
      
      // If there are images and it's the first user message, attach them
      // In Gemini, images are sent as inlineData parts alongside the text prompt
      if (m.role === 'user' && request.images && request.images.length > 0) {
        request.images.forEach((img) => {
          // Clean base64 data just in case it contains data:image/*;base64, prefix
          const cleanData = img.data.includes(';base64,')
            ? img.data.split(';base64,')[1]
            : img.data;

          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: cleanData,
            },
          });
        });
      }

      // If there is audio and it's the first user message, attach it
      if (m.role === 'user' && request.audio) {
        const cleanAudioData = request.audio.data.includes(';base64,')
          ? request.audio.data.split(';base64,')[1]
          : request.audio.data;

        parts.push({
          inlineData: {
            mimeType: request.audio.mimeType,
            data: cleanAudioData,
          },
        });
      }

      parts.push({ text: m.content });

      return {
        role: m.role === 'user' ? 'user' : 'model',
        parts,
      };
    });

    const body: any = {
      contents,
    };

    // System prompt mapping
    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    // Config options (Structured Output / JSON)
    if (request.responseMimeType || request.responseSchema) {
      body.generationConfig = {};
      if (request.responseMimeType) {
        body.generationConfig.responseMimeType = request.responseMimeType;
      }
      if (request.responseSchema) {
        body.generationConfig.responseSchema = request.responseSchema;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `Erro da API Gemini (código ${response.status})`;
      const isQuotaExceeded = response.status === 429 || (message && /quota|limit|exhausted/i.test(message));
      const isHighDemand = response.status === 503 || (message && /high demand|try again later/i.test(message));

      if (isQuotaExceeded) {
        throw new Error('Seu limite diário foi atingido (cota excedida)');
      } else if (isHighDemand) {
        throw new Error('Este modelo está enfrentando alta demanda no momento. Por favor, tente novamente mais tarde.');
      } else if (response.status === 400 || response.status === 403) {
        throw new Error('Chave de API do Gemini inválida ou sem permissão. Verifique sua chave nas configurações.');
      }
      throw new Error(message);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('A IA respondeu com sucesso, mas não retornou nenhum conteúdo válido.');
    }

    return text;
  }
}
