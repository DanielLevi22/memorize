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
  aiService: AIService,
  providerType: 'gemini' | 'ollama' = 'gemini',
  onProgress?: (current: number, total: number) => void
): Promise<{ title: string; translatedText: string; lines: ReadingLine[] }> {
  const { isBilingual, englishLines, translationMap } = extractBilingualMap(originalText);
  const linesOfText: string[] = [];
  
  if (isBilingual) {
    englishLines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        linesOfText.push(trimmed);
      }
    });
  } else {
    originalText.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Segment lines by sentence boundaries (. ! ?) followed by whitespace and a capital letter/number/accented character,
      // ignoring common abbreviations like Dr., Mr., vs., etc. and supporting optional enclosing quotes.
      const sentences = trimmed
        .replace(/(?<!\b(?:Dr|Mr|Ms|Mrs|Jr|Sr|vs|Prof|St|i\.e|e\.g))([.!?])(["'”’]?)\s+(?=["'“‘]?[A-Z0-9\u00C0-\u00FF])/gi, '$1$2|')
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      linesOfText.push(...sentences);
    });
  }

  if (linesOfText.length === 0) {
    return { title: 'Texto sem título', translatedText: '', lines: [] };
  }

  // Tell Ollama to process smaller chunks (8 lines) to avoid context/output token limits.
  // Gemini receives larger chunks (30 lines).
  const chunkSize = providerType === 'ollama' ? 8 : 30;
  const chunks: string[] = [];
  for (let i = 0; i < linesOfText.length; i += chunkSize) {
    chunks.push(linesOfText.slice(i, i + chunkSize).join('\n'));
  }

  let finalTitle = 'Texto sem título';
  const allLines: ReadingLine[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkText = chunks[idx];
    if (onProgress) {
      onProgress(idx + 1, chunks.length);
    }

    const promptText = `
Você é um especialista em ensino de idiomas. Receba o bloco de texto fornecido.

Seu objetivo é analisar o texto, segmentá-lo em frases e retornar a estrutura JSON contendo:
1. Um título curto e descritivo para o texto (campo "title")
2. Para cada frase/sentença do texto:
   - "original": a frase exatamente no idioma original de estudo (ex: em inglês)
   - "translated": a tradução correspondente para português do Brasil
   - "highlights": 2 a 4 palavras ou expressões-chave da frase original que são importantes para o aprendizado de vocabulário

Regras importantes:
- **Segmentação Estrita**: Cada frase/sentença individual do texto fornecido deve ser mapeada para um objeto separado no array "lines". Nunca junte ou mescle múltiplas frases/sentenças em uma única entrada no campo "original". Cada linha de entrada contendo uma frase deve virar uma entrada distinta no JSON.
- **Detecção de Conteúdo Bilíngue**: Se o texto contiver frases no idioma original intercaladas com suas traduções correspondentes em português (ex: uma linha em inglês seguida da tradução em português), você DEVE extrair e usar exatamente as traduções existentes no texto.
- **Caso não haja Tradução**: Se o texto contiver apenas sentenças no idioma original, traduza cada frase de forma natural para o português do Brasil.
- **Idioma Original**: O campo "original" DEVE conter a frase estritamente no idioma original (ex: inglês), exatamente como escrita. Nunca coloque a tradução ou texto em português dentro do campo "original".
- Mantenha a ordem original das frases.
- Não pule nenhuma frase do bloco de texto.

---
EXEMPLO 1 (ENTRADA BILÍNGUE INTERCALADA):
Entrada:
"He works hard sewing and mending clothes for the saints and angels,”
“Ele trabalha duro costurando e remendando roupas para as santidades e os anjos,”
“but even so, he sometimes doesn’t have enough money to eat.”
mas mesmo assim, ele às vezes não tem dinheiro o suficiente para comer.

Saída JSON esperada:
{
  "title": "Trabalho e persistência",
  "lines": [
    {
      "original": "He works hard sewing and mending clothes for the saints and angels,”",
      "translated": "Ele trabalha duro costurando e remendando roupas para as santidades e os anjos,",
      "highlights": ["sewing", "mending", "saints"]
    },
    {
      "original": "“but even so, he sometimes doesn’t have enough money to eat.”",
      "translated": "mas mesmo assim, ele às vezes não tem dinheiro o suficiente para comer.",
      "highlights": ["money", "eat"]
    }
  ]
}

---
EXEMPLO 2 (ENTRADA MONOLÍNGUE EM INGLÊS):
Entrada:
She went to the market. She wanted to buy some fresh apples.

Saída JSON esperada:
{
  "title": "Ida ao mercado",
  "lines": [
    {
      "original": "She went to the market.",
      "translated": "Ela foi ao mercado.",
      "highlights": ["market"]
    },
    {
      "original": "She wanted to buy some fresh apples.",
      "translated": "Ela queria comprar algumas maçãs frescas.",
      "highlights": ["buy", "fresh", "apples"]
    }
  ]
}

---
TEXTO DO BLOCO A SER PROCESSADO:
${chunkText}
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
    if (idx === 0) {
      finalTitle = parsed.title;
    }
    allLines.push(...parsed.lines);
  }

  // If bilingual, override the translations with our exact pre-aligned ones
  if (isBilingual) {
    const cleanKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9\u00C0-\u00FF]/g, '');
    const cleanMap = new Map<string, string>();
    translationMap.forEach((val, key) => {
      cleanMap.set(cleanKey(key), val);
    });

    allLines.forEach((line) => {
      const k = cleanKey(line.original);
      const matchedTranslation = cleanMap.get(k);
      if (matchedTranslation) {
        line.translated = matchedTranslation;
      }
    });
  }

  const translatedText = allLines.map((l) => l.translated).join('\n');
  return { title: finalTitle, translatedText, lines: allLines };
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
  let cleanJson = jsonString.trim();
  
  // Remove markdown code block wrappers if present
  if (cleanJson.startsWith('```')) {
    const lines = cleanJson.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    cleanJson = lines.join('\n').trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    // Try to extract JSON from inside the string if it contains markdown/conversational text around it
    const startIdx = cleanJson.indexOf('{');
    const endIdx = cleanJson.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        parsed = JSON.parse(cleanJson.substring(startIdx, endIdx + 1));
      } catch {
        throw new Error('Resposta da IA não é um JSON válido.');
      }
    } else {
      throw new Error('Resposta da IA não é um JSON válido.');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Resposta da IA com formato inesperado.');
  }

  let title = 'Texto sem título';
  let rawLines: any = null;

  if (Array.isArray(parsed)) {
    rawLines = parsed;
  } else {
    if (typeof parsed.title === 'string') {
      title = parsed.title;
    } else if (parsed.response && typeof parsed.response.title === 'string') {
      title = parsed.response.title;
    }

    rawLines = parsed.lines;
    if (!Array.isArray(rawLines)) {
      if (parsed.response && Array.isArray(parsed.response.lines)) {
        rawLines = parsed.response.lines;
      } else if (parsed.data && Array.isArray(parsed.data.lines)) {
        rawLines = parsed.data.lines;
      } else {
        const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
        if (arrayKey) {
          rawLines = parsed[arrayKey];
        } else {
          // Search for nested objects that look like lines
          const possibleLines: any[] = [];
          Object.keys(parsed).forEach(key => {
            const val = parsed[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              if ('original' in val || 'text' in val || 'originalText' in val) {
                possibleLines.push(val);
              }
            }
          });
          if (possibleLines.length > 0) {
            rawLines = possibleLines;
          }
        }
      }
    }
  }

  if (!Array.isArray(rawLines)) {
    const keysStr = Object.keys(parsed).join(', ');
    const sample = jsonString.length > 250 ? jsonString.substring(0, 250) + '...' : jsonString;
    throw new Error(`Resposta da IA não contém o campo "lines" ou a lista de frases. Chaves encontradas: ${keysStr}. Retorno: ${sample}`);
  }

  const lines: ReadingLine[] = rawLines.map((line: any) => {
    // Defensively map original text
    const original = typeof line.original === 'string' ? line.original 
                     : typeof line.text === 'string' ? line.text
                     : typeof line.originalText === 'string' ? line.originalText
                     : '';

    // Defensively map translation
    const translated = typeof line.translated === 'string' ? line.translated 
                       : typeof line.translation === 'string' ? line.translation
                       : typeof line.translatedText === 'string' ? line.translatedText
                       : '';

    // Cleanup if translation was merged into the original field by the AI
    let cleanOriginal = original.trim();
    const cleanTranslated = translated.trim();
    if (cleanTranslated && cleanOriginal.toLowerCase().includes(cleanTranslated.toLowerCase())) {
      const idx = cleanOriginal.toLowerCase().indexOf(cleanTranslated.toLowerCase());
      if (idx > 0) {
        cleanOriginal = cleanOriginal.substring(0, idx).trim();
        cleanOriginal = cleanOriginal.replace(/[\s,\/;\\-]+$/, '').trim();
      }
    }

    // Highlights mapping
    let highlights: string[] = [];
    if (Array.isArray(line.highlights)) {
      highlights = line.highlights.filter((h: any) => typeof h === 'string');
    } else if (Array.isArray(line.keywords)) {
      highlights = line.keywords.filter((h: any) => typeof h === 'string');
    } else if (typeof line.highlights === 'string') {
      highlights = (line.highlights as string).split(',').map(h => h.trim()).filter(Boolean);
    }

    return {
      id: line.id || crypto.randomUUID(),
      original: cleanOriginal,
      translated: cleanTranslated,
      highlights,
      mastered: false,
    };
  });

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

/**
 * Detecta se o texto original é composto por linhas bilíngues intercaladas (Inglês/Português)
 * e retorna uma listagem apenas com as sentenças em inglês e o mapeamento de tradução correspondente.
 */
export function extractBilingualMap(originalText: string): {
  isBilingual: boolean;
  englishLines: string[];
  translationMap: Map<string, string>;
} {
  const rawLines = originalText.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length < 2) {
    return { isBilingual: false, englishLines: rawLines, translationMap: new Map() };
  }

  // Heurística simples de detecção de idioma baseada em palavras funcionais comuns
  const detectLanguageSimple = (text: string): 'en' | 'pt' | 'unknown' => {
    const words = text.toLowerCase().split(/\s+/);
    
    const enWords = new Set([
      'the', 'and', 'of', 'to', 'a', 'in', 'is', 'that', 'was', 'he', 'for', 'it', 'with', 'his', 'as', 'on', 'you', 'i', 'they', 'at', 'be', 'this', 'have', 'from',
      'soldier', 'called', 'lived', 'poor', 'coat', 'stupid', 'fox', 'sly', 'road', 'trip', 'travel', 'hobbies', 'job', 'interview', 'recruiter', 'teacher'
    ]);
    const ptWords = new Set([
      'o', 'a', 'de', 'do', 'da', 'em', 'um', 'uma', 'que', 'se', 'com', 'não', 'é', 'para', 'os', 'as', 'seu', 'sua',
      'soldado', 'chamado', 'vivia', 'velho', 'casaco', 'esperto', 'raposa', 'viagem', 'entrevista', 'recrutador', 'professor'
    ]);
    
    let enCount = 0;
    let ptCount = 0;
    
    words.forEach(w => {
      const clean = w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'”’]/g, "");
      if (enWords.has(clean)) enCount++;
      if (ptWords.has(clean)) ptCount++;
    });
    
    const ptChars = /[ãõçáéíóúâêô]/i;
    if (ptChars.test(text)) {
      ptCount += 2;
    }
    
    if (enCount > ptCount) return 'en';
    if (ptCount > enCount) return 'pt';
    return 'unknown';
  };

  // Verifica se as linhas iniciais se alternam entre inglês e português
  let alternatingMatches = 0;
  let checkedCount = 0;
  const sampleSize = Math.min(rawLines.length - 1, 10);
  
  for (let i = 0; i < sampleSize; i += 2) {
    const langA = detectLanguageSimple(rawLines[i]);
    const langB = detectLanguageSimple(rawLines[i+1]);
    if (langA === 'en' && langB === 'pt') {
      alternatingMatches++;
    }
    checkedCount++;
  }

  const isBilingual = checkedCount > 0 && (alternatingMatches / checkedCount) >= 0.5;

  if (!isBilingual) {
    return { isBilingual: false, englishLines: rawLines, translationMap: new Map() };
  }

  // Alinha as linhas de forma pareada
  const englishLines: string[] = [];
  const translationMap = new Map<string, string>();
  const pairedIndexes = new Set<number>();

  for (let i = 0; i < rawLines.length; i++) {
    if (pairedIndexes.has(i)) continue;
    
    const line = rawLines[i];
    const lang = detectLanguageSimple(line);
    
    if (lang === 'pt') {
      // Linha solta em português (provavelmente sem correspondente em inglês), ignora do original
      continue;
    }
    
    const nextLine = rawLines[i + 1];
    if (nextLine) {
      const nextLang = detectLanguageSimple(nextLine);
      if (nextLang === 'pt') {
        englishLines.push(line);
        translationMap.set(line, nextLine);
        pairedIndexes.add(i + 1);
        continue;
      }
    }
    
    englishLines.push(line);
  }

  return { isBilingual: true, englishLines, translationMap };
}

