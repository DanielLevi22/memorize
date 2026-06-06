import type { ReadingLine } from '../types';
import type { AIService } from '../services/ai/types';

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
 * Processa texto com IA:
 * - Segmenta em frases
 * - Traduz cada frase
 * - Identifica palavras-chave para highlight
 */
export async function processTextWithAI(
  originalText: string,
  aiService: AIService
): Promise<{ title: string; translatedText: string; lines: ReadingLine[] }> {
  const promptText = `
Você é um especialista em ensino de idiomas. Receba o texto fornecido (que pode ser a extração de um PDF contendo texto bilíngue com frases no idioma original e suas respectivas traduções logo abaixo, ou apenas o texto simples no idioma original).

Seu objetivo é analisar o texto, segmentá-lo em frases e retornar a estrutura JSON:
1. Um título curto e descritivo para o texto (campo "title")
2. Para cada frase/sentença do texto:
   - "original": a frase exatamente no idioma original de estudo (ex: em inglês)
   - "translated": a tradução correspondente para português do Brasil
   - "highlights": 2 a 4 palavras ou expressões-chave da frase original que são importantes para o aprendizado de vocabulário

Regras de Segmentação e Tradução Inteligente:
- **Detecção de Conteúdo Bilíngue**: Analise se o texto fornecido já contém pares de frases em inglês seguidas de suas traduções em português (ex: uma linha em inglês e a linha seguinte com a tradução em português, ou a tradução entre parênteses/itálico). Se o texto já contiver as traduções originais das frases, você DEVE extrair e usar exatamente as traduções existentes no texto para o campo "translated", em vez de gerar novas traduções do zero.
- **Caso não haja Tradução no Texto**: Se o texto contiver apenas sentenças no idioma original (ex: apenas inglês), você deve traduzir cada frase de forma natural e coloquial para o português do Brasil no campo "translated".
- **Idioma Original**: O campo "original" DEVE conter a frase estritamente no idioma original (ex: inglês), exatamente como escrita no texto original. Nunca coloque a tradução no campo "original".
- Mantenha a ordem original das frases.
- As highlights devem ser palavras que aparecem EXATAMENTE na frase original (no idioma original).
- Não pule nenhuma frase do texto.

TEXTO:
${originalText}
`;

  const textResponse = await aiService.generateContent({
    messages: [{ role: 'user', content: promptText }],
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
    }
  });

  const parsed = parseAIResponse(textResponse);
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

