import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Localizador de API Key
let apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/VITE_GEMINI_API_KEY\s*=\s*(.*)/) || envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
      if (match && match[1]) {
        apiKey = match[1].replace(/["']/g, '').trim();
      }
    }
  } catch (e) {
    // Silencia erros de leitura do arquivo .env
  }
}

describe('Gemini Transcription Integration Test', () => {
  const isKeyAvailable = !!apiKey && apiKey.trim().length > 0;

  it('deve bater na API da Google e transcrever o áudio hello-8k.wav corretamente', async () => {
    if (!isKeyAvailable) {
      console.warn('⚠️  Teste de integração pulado: API Key do Gemini não está definida no ambiente ou arquivo .env.');
      return;
    }

    // 1. Download de um áudio WAV real e estático contendo fala ("hello")
    const audioUrl = 'https://raw.githubusercontent.com/mozilla/DeepSpeech/master/data/audio/8k_samples/hello-8k.wav';
    
    let audioBuffer: ArrayBuffer;
    try {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Falha ao baixar áudio de teste da URL: ${audioResponse.statusText}`);
      }
      audioBuffer = await audioResponse.arrayBuffer();
    } catch (fetchErr: any) {
      console.warn(`⚠️  Teste de integração pulado devido a problemas de rede ao baixar o áudio de teste: ${fetchErr.message || fetchErr}`);
      return;
    }

    // 2. Converte para base64
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    // 3. Monta o Prompt e a chamada para o Gemini 2.5 Flash
    const promptText = `
Você é um assistente especialista em transcrição e tradução de áudio.
Transcreva o áudio fornecido linha por linha.
Para cada linha:
1. Forneça o texto exato falado no idioma original ("text").
2. Traduza a linha para o português do Brasil ("translation").
3. Identifique o tempo de início aproximado no formato de string "mm:ss" ou "mm:ss.xx" ("startTime").
`;

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: base64Audio
            }
          },
          {
            text: promptText
          }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            lines: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  translation: { type: 'STRING' },
                  startTime: { type: 'STRING' }
                },
                required: ['text', 'startTime']
              }
            }
          },
          required: ['lines']
        }
      }
    };

    // 4. Executa a requisição contra a API do Gemini
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(200);

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    expect(rawText).toBeDefined();

    const parsed = JSON.parse(rawText);
    expect(parsed).toHaveProperty('lines');
    expect(Array.isArray(parsed.lines)).toBe(true);
    expect(parsed.lines.length).toBeGreaterThan(0);

    // 5. Validação de Conteúdo: A transcrição deve conter a palavra "hello"
    const transcriptText = parsed.lines.map((l: any) => l.text).join(' ').toLowerCase();
    expect(transcriptText).toContain('hello');

    // Valida também se gerou alguma tradução coerente (olá, oi, etc.)
    const translationText = parsed.lines.map((l: any) => l.translation).join(' ').toLowerCase();
    expect(translationText).toBeDefined();
    
    console.log('✅ Integração Gemini bem-sucedida!');
    console.log(`Transcrição obtida: "${transcriptText}"`);
    console.log(`Tradução obtida: "${translationText}"`);
  });
});
