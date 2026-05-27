import type { ReadingLine } from '../types';

/**
 * Extrai texto de um arquivo PDF usando pdf.js (pdfjs-dist).
 * Funciona 100% client-side, sem servidor.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configurar o worker inline para evitar problemas de CORS/bundling
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText.trim());
  }

  return pages.join('\n\n');
}

/**
 * Processa texto com Gemini AI:
 * - Segmenta em frases
 * - Traduz cada frase
 * - Identifica palavras-chave para highlight
 */
export async function processTextWithAI(
  originalText: string,
  apiKey: string
): Promise<{ title: string; translatedText: string; lines: ReadingLine[] }> {
  const promptText = `
Você é um especialista em ensino de idiomas. Receba o texto abaixo e retorne:

1. Um título curto e descritivo para o texto (campo "title")
2. Para cada frase/sentença do texto:
   - "original": a frase no idioma original (exatamente como está escrita no texto fornecido, sem qualquer tradução)
   - "translated": a tradução natural para português do Brasil
   - "highlights": 2 a 4 palavras ou expressões-chave da frase original que são importantes para o aprendizado de vocabulário

Regras:
- Separe o texto em frases naturais (por pontuação: . ! ? ou quebras de linha significativas)
- Mantenha a ordem original das frases
- ATENÇÃO CRÍTICA: O campo "original" DEVE ser mantido no idioma original (ex: inglês, espanhol, etc.) conforme enviado no texto abaixo. NUNCA coloque a tradução em português no campo "original". Apenas o campo "translated" deve ser traduzido para o português.
- As highlights devem ser palavras que aparecem EXATAMENTE na frase original (no idioma original)
- A tradução deve ser natural e coloquial, não literal
- Não pule nenhuma frase do texto

TEXTO:
${originalText}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: 'Título curto e descritivo do texto' },
              lines: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    original: { type: 'STRING', description: 'A frase no idioma original de estudo (ex: em inglês, sem tradução).' },
                    translated: { type: 'STRING', description: 'A tradução da frase original para português do Brasil.' },
                    highlights: {
                      type: 'ARRAY',
                      items: { type: 'STRING' },
                      description: '2-4 palavras-chave do original (no idioma original)',
                    },
                  },
                  required: ['original', 'translated', 'highlights'],
                },
              },
            },
            required: ['title', 'lines'],
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Erro da API (código ${response.status})`;
    const isQuotaExceeded = response.status === 429 || (message && /quota|limit|exhausted/i.test(message));
    const isHighDemand = response.status === 503 || (message && /high demand|try again later/i.test(message));
    
    if (isQuotaExceeded) {
      throw new Error('Seu limite diário foi atingido');
    } else if (isHighDemand) {
      throw new Error('Este modelo está enfrentando alta demanda no momento. Picos de demanda geralmente são temporários. Por favor, tente novamente mais tarde.');
    } else if (response.status === 400 || response.status === 403) {
      throw new Error('Chave de API inválida ou sem permissão. Verifique sua chave nas configurações.');
    }
    throw new Error(message);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('A IA respondeu, mas não retornou um conteúdo estruturado válido.');
  }

  const parsed = parseAIResponse(text);
  return parsed;
}

/**
 * Parseia e valida a resposta JSON da IA.
 * Exportada para testes unitários.
 */
export function parseAIResponse(jsonString: string): {
  title: string;
  translatedText: string;
  lines: ReadingLine[];
} {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Resposta da IA não é um JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Resposta da IA tem formato inesperado.');
  }

  const title = typeof parsed.title === 'string' ? parsed.title : 'Texto sem título';

  if (!Array.isArray(parsed.lines)) {
    throw new Error('Resposta da IA não contém o campo "lines".');
  }

  const lines: ReadingLine[] = parsed.lines.map((line: any) => ({
    id: line.id || crypto.randomUUID(),
    original: typeof line.original === 'string' ? line.original : '',
    translated: typeof line.translated === 'string' ? line.translated : '',
    highlights: Array.isArray(line.highlights)
      ? line.highlights.filter((h: any) => typeof h === 'string')
      : [],
    mastered: false,
  }));

  const translatedText = lines.map((l) => l.translated).join('\n');

  return { title, translatedText, lines };
}

/**
 * Segmenta texto manualmente por quebras de linha.
 * Cada par de linhas (original[i] ↔ translated[i]) vira um ReadingLine.
 * Usado quando a IA NÃO é ativada.
 */
export function segmentTextManually(
  originalText: string,
  translatedText: string
): ReadingLine[] {
  const originalLines = originalText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const translatedLines = translatedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return originalLines.map((original, i) => ({
    id: crypto.randomUUID(),
    original,
    translated: translatedLines[i] || '',
    highlights: [],
    mastered: false,
  }));
}

/**
 * Traduz texto usando a API gratuita MyMemory (limitada a 1000 palavras/dia por IP).
 */
export async function translateWithMyMemory(
  text: string,
  sourceLang = 'en',
  targetLang = 'pt'
): Promise<string> {
  if (!text.trim()) return '';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${sourceLang}|${targetLang}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro na API MyMemory: código ${response.status}`);
  }
  const data = await response.json();
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Erro de resposta da API MyMemory');
  }
  return data.responseData?.translatedText || '';
}

/**
 * Segmenta um texto original em sentenças (por regex de pontuação) e as traduz
 * usando a API pública gratuita do MyMemory sequencialmente.
 */
export async function segmentAndTranslateWithFreeAPI(
  originalText: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ title: string; lines: ReadingLine[] }> {
  // Extrai a primeira linha/sentença para fazer o título padrão
  const linesOfText = originalText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  
  const firstLine = linesOfText[0] || 'Texto Sem Título';
  const title = firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;

  // Segmenta o texto original em frases por pontuação (. ! ?) seguida de espaço/nova linha
  const rawSentences = originalText
    .replace(/([.!?])\s+(?=[A-Z0-9\u00C0-\u00FF])/g, '$1|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const lines: ReadingLine[] = [];
  const total = rawSentences.length;

  for (let i = 0; i < total; i++) {
    const sentence = rawSentences[i];
    let translated = '';
    
    if (onProgress) {
      onProgress(i + 1, total);
    }

    try {
      translated = await translateWithMyMemory(sentence);
      // Pausa pequena de 200ms para respeitar a API e evitar rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (e) {
      console.error(`Falha ao traduzir a frase "${sentence}":`, e);
      translated = ''; // salva em branco se falhar para não travar toda a importação
    }

    lines.push({
      id: crypto.randomUUID(),
      original: sentence,
      translated,
      highlights: [],
      mastered: false,
    });
  }

  return { title, lines };
}

