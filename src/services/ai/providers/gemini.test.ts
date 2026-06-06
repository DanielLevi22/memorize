import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from './gemini';

describe('GeminiProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve disparar erro se a chave de API estiver em branco', async () => {
    const provider = new GeminiProvider('');
    await expect(
      provider.generateContent({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('Chave de API do Gemini não configurada');
  });

  it('deve gerar conteúdo simples com sucesso', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello, I am Gemini!' }],
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new GeminiProvider('mock-key');
    const result = await provider.generateContent({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result).toBe('Hello, I am Gemini!');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.5-flash:generateContent?key=mock-key'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"text":"Hello"'),
      })
    );
  });

  it('deve formatar corretamente imagens inlineData e prompts de sistema', async () => {
    const mockResponse = {
      candidates: [{ content: { parts: [{ text: 'Image read' }] } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new GeminiProvider('mock-key');
    await provider.generateContent({
      systemPrompt: 'You are an OCR reader',
      messages: [{ role: 'user', content: 'What is this?' }],
      images: [
        { mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,ABC' }
      ]
    });

    const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    
    // Check system instruction
    expect(calledBody.systemInstruction.parts[0].text).toBe('You are an OCR reader');
    
    // Check user parts (should contain inlineData and text prompt)
    const userParts = calledBody.contents[0].parts;
    expect(userParts[0].inlineData.mimeType).toBe('image/jpeg');
    expect(userParts[0].inlineData.data).toBe('ABC'); // clean base64 data without prefix
    expect(userParts[1].text).toBe('What is this?');
  });

  it('deve lidar com limite de cota excedido (429)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Quota exceeded.' } }),
      } as Response;
    });

    const provider = new GeminiProvider('mock-key');
    await expect(
      provider.generateContent({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('limite diário foi atingido');
  });

  it('deve lidar com chave inválida (400/403)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'API key not valid.' } }),
      } as Response;
    });

    const provider = new GeminiProvider('mock-key');
    await expect(
      provider.generateContent({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('Chave de API do Gemini inválida');
  });

  it('deve formatar áudio inlineData corretamente', async () => {
    const mockResponse = {
      candidates: [{ content: { parts: [{ text: 'Audio received' }] } }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new GeminiProvider('mock-key');
    const result = await provider.generateContent({
      messages: [{ role: 'user', content: 'Transcribe this' }],
      audio: { mimeType: 'audio/wav', data: 'data:audio/wav;base64,12345' }
    });

    expect(result).toBe('Audio received');
    const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    const userParts = calledBody.contents[0].parts;
    expect(userParts[0].inlineData.mimeType).toBe('audio/wav');
    expect(userParts[0].inlineData.data).toBe('12345');
    expect(userParts[1].text).toBe('Transcribe this');
  });
});
