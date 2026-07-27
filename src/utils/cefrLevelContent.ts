import type { TextResource } from '../types';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Progresso de leitura por nível CEFR.
 *
 * O app já semeia textos marcados por `cefrLevel`, mas não havia noção de "quanto do nível
 * o aluno leu". Isto dá ao aluno um alvo concreto — "estude N textos de A1 para completar" —
 * em vez de só uma contagem abstrata de vocabulário.
 */
export interface LevelContentProgress {
  level: CefrLevel;
  total: number;     // textos disponíveis no nível
  studied: number;   // quantos o aluno concluiu
  target: number;    // meta recomendada para "completar" a leitura do nível
  percent: number;   // progresso rumo à meta (0-100)
  remaining: number; // textos ainda a estudar até a meta (>= 0)
}

/** Os seis níveis CEFR em ordem crescente. */
export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Meta de textos por nível. Cresce com o nível porque a competência exigida aumenta.
 * São alvos pedagógicos, não limites: o aluno pode ler além.
 */
export const LEVEL_TEXT_TARGET: Record<CefrLevel, number> = {
  A1: 8,
  A2: 10,
  B1: 12,
  B2: 15,
  C1: 18,
  C2: 20
};

/**
 * Um texto conta como "estudado" quando todas as suas linhas foram marcadas como dominadas.
 * Textos sem linhas nunca contam (não há o que dominar).
 */
export const isTextStudied = (text: Pick<TextResource, 'lines'>): boolean => {
  const lines = text.lines ?? [];
  return lines.length > 0 && lines.every(l => l.mastered);
};

/**
 * Calcula o progresso de leitura de um nível a partir da lista de textos.
 *
 * `studiedPredicate` é injetável para os testes e para futuras definições de "estudado"
 * (ex.: baseada em sessões de leitura em vez de linhas dominadas).
 */
export const getLevelContentProgress = (
  texts: Pick<TextResource, 'cefrLevel' | 'lines'>[],
  level: CefrLevel,
  studiedPredicate: (t: Pick<TextResource, 'lines'>) => boolean = isTextStudied
): LevelContentProgress => {
  const levelTexts = texts.filter(t => t.cefrLevel === level);
  const total = levelTexts.length;
  const studied = levelTexts.filter(studiedPredicate).length;
  const target = LEVEL_TEXT_TARGET[level];

  // Progresso é medido contra a meta, mas o aluno pode ter estudado mais que ela: trava em 100%
  const percent = target > 0 ? Math.min(100, Math.round((studied / target) * 100)) : 0;
  const remaining = Math.max(0, target - studied);

  return { level, total, studied, target, percent, remaining };
};

export interface StudyLevelShelf<T extends Pick<TextResource, 'cefrLevel' | 'lines'>> {
  level: CefrLevel;
  texts: T[];
  progress: LevelContentProgress;
}

/**
 * Organiza os textos de estudo em prateleiras por nível (A1→C2), cada uma com seus textos e
 * o progresso correspondente. É a fonte de dados da vitrine de leitura por nível.
 *
 * Considera "texto de estudo" qualquer texto com `cefrLevel` definido — inclui tanto o
 * conteúdo curado semeado quanto textos que o próprio usuário marcou com um nível.
 */
export const buildStudyLibrary = <T extends Pick<TextResource, 'cefrLevel' | 'lines'>>(
  texts: T[],
  studiedPredicate: (t: Pick<TextResource, 'lines'>) => boolean = isTextStudied
): StudyLevelShelf<T>[] => {
  return CEFR_LEVELS.map(level => ({
    level,
    texts: texts.filter(t => t.cefrLevel === level),
    progress: getLevelContentProgress(texts, level, studiedPredicate)
  }));
};
