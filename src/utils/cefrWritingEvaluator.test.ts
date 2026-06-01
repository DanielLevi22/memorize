import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGeminiWritingPrompt, evaluateWritingWithGemini } from './cefrWritingEvaluator';

describe('cefrWritingEvaluator: Avaliador de Redação Gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve gerar prompt contendo instruções, redação e nível do exame', () => {
    const prompt = buildGeminiWritingPrompt('B2', 'Write about sports', 'I love soccer');

    expect(prompt).toContain('B2');
    expect(prompt).toContain('Write about sports');
    expect(prompt).toContain('I love soccer');
    expect(prompt).toContain('JSON');
  });

  it('deve processar resposta de sucesso do Gemini e extrair nota e feedback', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '```json\n{"score": 85, "feedback": "Excelente escrita e coesão."}\n```'
              }
            ]
          }
        }
      ]
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockResponse
      } as Response;
    });

    const result = await evaluateWritingWithGemini(
      'B2',
      'Write about sports',
      'I love soccer',
      'test-api-key'
    );

    expect(result.score).toBe(85);
    expect(result.feedback).toBe('Excelente escrita e coesão.');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('test-api-key'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  it('deve disparar erro se a chamada de rede falhar', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false
      } as Response;
    });

    await expect(
      evaluateWritingWithGemini('B2', 'Write', 'Text', 'key')
    ).rejects.toThrow('Falha na chamada de API do Gemini');
  });

  it('deve disparar erro se a estrutura JSON retornada for inválida ou incompleta', async () => {
    const mockInvalidResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '{"nota_invalida": 90}' // Falta o campo score e feedback
              }
            ]
          }
        }
      ]
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => mockInvalidResponse
      } as Response;
    });

    await expect(
      evaluateWritingWithGemini('B2', 'Write', 'Text', 'key')
    ).rejects.toThrow('Formato de resposta JSON do Gemini inválido');
  });
});
