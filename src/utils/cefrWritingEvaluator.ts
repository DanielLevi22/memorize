/**
 * Constrói o prompt para avaliação da redação CEFR.
 */
export function buildGeminiWritingPrompt(level: string, instructions: string, text: string): string {
  return `Você é um avaliador de proficiência em inglês especializado em certificações CEFR.
Examine a seguinte redação escrita por um aluno no nível ${level}.

Proposta de Escrita:
"${instructions}"

Texto do Aluno:
"${text}"

Avalie o texto segundo critérios de vocabulário, gramática, coerência e adequação ao tema.
Você deve retornar OBRIGATORIAMENTE um JSON puro (sem markdown, sem tags, sem \`\`\`json) contendo os campos:
1. "score": Uma nota numérica inteira de 0 a 100 correspondente à qualidade do texto para o nível do exame.
2. "feedback": Um parágrafo curto e construtivo em português com conselhos de melhoria.

Exemplo de formato esperado:
{"score": 75, "feedback": "Bom domínio vocabular, porém cometeu pequenos deslizes na concordância..."}`;
}

export interface WritingEvaluationResult {
  score: number;
  feedback: string;
}

/**
 * Faz a chamada de API para o Gemini e retorna o resultado estruturado.
 */
export async function evaluateWritingWithGemini(
  level: string,
  instructions: string,
  text: string,
  apiKey: string
): Promise<WritingEvaluationResult> {
  const promptText = buildGeminiWritingPrompt(level, instructions, text);
  
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    }
  );

  if (!res.ok) {
    throw new Error('Falha na chamada de API do Gemini');
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  
  const parsed = JSON.parse(cleanJsonStr);
  if (typeof parsed.score !== 'number' || typeof parsed.feedback !== 'string') {
    throw new Error('Formato de resposta JSON do Gemini inválido');
  }

  return {
    score: parsed.score,
    feedback: parsed.feedback
  };
}
