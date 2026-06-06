import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaProvider } from './ollama';

describe('OllamaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve gerar conteúdo de chat simples com sucesso', async () => {
    const mockResponse = {
      model: 'llama3.2',
      message: {
        role: 'assistant',
        content: 'Hello, I am Ollama running locally!',
      },
      done: true,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
    const result = await provider.generateContent({
      messages: [{ role: 'user', content: 'Hello local' }],
    });

    expect(result).toBe('Hello, I am Ollama running locally!');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"model":"llama3.2"'),
      })
    );

    const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(calledBody.messages[0].role).toBe('user');
    expect(calledBody.messages[0].content).toBe('Hello local');
    expect(calledBody.stream).toBe(false);
  });

  it('deve prepender prompt de sistema e mapear imagens e formato JSON', async () => {
    const mockResponse = {
      message: { role: 'assistant', content: '{"status": "ok"}' },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new OllamaProvider('http://my-server:11434/', 'custom-model');
    await provider.generateContent({
      systemPrompt: 'System instructions here',
      messages: [{ role: 'user', content: 'Process this' }],
      responseMimeType: 'application/json',
      images: [
        { mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,XYZ' }
      ]
    });

    // Verify trailing slash removal
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://my-server:11434/api/chat',
      expect.any(Object)
    );

    const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(calledBody.model).toBe('custom-model');
    expect(calledBody.format).toBe('json');
    
    // Check message order
    expect(calledBody.messages).toHaveLength(2);
    expect(calledBody.messages[0].role).toBe('system');
    expect(calledBody.messages[0].content).toBe('System instructions here');
    
    expect(calledBody.messages[1].role).toBe('user');
    expect(calledBody.messages[1].content).toBe('Process this');
    expect(calledBody.messages[1].images[0]).toBe('XYZ'); // clean base64 data
  });

  it('deve fornecer dica de suporte/CORS ao falhar conexao de rede local', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const err = new TypeError('Failed to fetch');
      throw err;
    });

    const provider = new OllamaProvider('http://localhost:11434');
    await expect(
      provider.generateContent({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('Não foi possível conectar ao Ollama local. Certifique-se de que');
  });

  it('deve repassar erros de status HTTP do servidor', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Model load failed.',
      } as Response;
    });

    const provider = new OllamaProvider('http://localhost:11434');
    await expect(
      provider.generateContent({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('Erro do servidor Ollama (código 500): Model load failed.');
  });

  it('deve disparar erro se a requisição contiver áudio', async () => {
    const provider = new OllamaProvider('http://localhost:11434');
    await expect(
      provider.generateContent({
        messages: [{ role: 'user', content: 'transcribe' }],
        audio: { mimeType: 'audio/wav', data: '123' }
      })
    ).rejects.toThrow('O Ollama local não suporta análise de áudio diretamente');
  });
});
