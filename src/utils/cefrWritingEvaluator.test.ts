import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGeminiWritingPrompt, evaluateWritingWithGemini } from './cefrWritingEvaluator';
import type { AIService } from '../services/ai/types';

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

  it('deve processar resposta de sucesso da IA e extrair nota e feedback', async () => {
    const mockService: AIService = {
      generateContent: vi.fn().mockResolvedValue('{"score": 85, "feedback": "Excelente escrita e coesão."}')
    };

    const result = await evaluateWritingWithGemini(
      'B2',
      'Write about sports',
      'I love soccer',
      mockService
    );

    expect(result.score).toBe(85);
    expect(result.feedback).toBe('Excelente escrita e coesão.');
    expect(mockService.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('I love soccer')
          })
        ]),
        responseMimeType: 'application/json'
      })
    );
  });

  it('deve disparar erro se a chamada do serviço falhar', async () => {
    const mockService: AIService = {
      generateContent: vi.fn().mockRejectedValue(new Error('Erro do serviço de IA'))
    };

    await expect(
      evaluateWritingWithGemini('B2', 'Write', 'Text', mockService)
    ).rejects.toThrow('Erro do serviço de IA');
  });

  it('deve disparar erro se a estrutura JSON retornada for inválida ou incompleta', async () => {
    const mockService: AIService = {
      generateContent: vi.fn().mockResolvedValue('{"nota_invalida": 90}')
    };

    await expect(
      evaluateWritingWithGemini('B2', 'Write', 'Text', mockService)
    ).rejects.toThrow('Formato de resposta JSON do Gemini inválido');
  });
});
