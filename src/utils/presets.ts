import type { DeckPreset } from '../types';

/**
 * Versão do formato de exportação. Permite compatibilidade futura.
 */
const EXPORT_VERSION = 1;

/**
 * Formato do arquivo de preset exportado (.json)
 */
export interface PresetExportFile {
  _format: 'memorize-preset';
  _version: number;
  _exportedAt: string;
  preset: Omit<DeckPreset, 'id'>;
}

/**
 * Serializa um preset para o formato de exportação JSON.
 * Remove o `id` pois ao importar o preset receberá um novo ID.
 */
export function serializePreset(preset: DeckPreset): string {
  const { id: _id, ...presetWithoutId } = preset;

  const exportData: PresetExportFile = {
    _format: 'memorize-preset',
    _version: EXPORT_VERSION,
    _exportedAt: new Date().toISOString(),
    preset: presetWithoutId,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Lista de todas as chaves obrigatórias do DeckPreset (exceto `id`).
 */
const REQUIRED_PRESET_KEYS: (keyof Omit<DeckPreset, 'id'>)[] = [
  'name',
  'newCardsPerDay',
  'maxReviewsPerDay',
  'newCardsIgnoreReviewLimit',
  'limitsStartFromParent',
  'learningSteps',
  'graduatingInterval',
  'easyInterval',
  'insertionOrder',
  'relearningSteps',
  'minimumInterval',
  'leechThreshold',
  'leechAction',
  'newCardGrouping',
  'newCardSorting',
  'newVsReviewOrder',
  'interdayLearningVsReviewOrder',
  'reviewSorting',
  'buryNewSiblings',
  'buryReviewSiblings',
  'buryLearningSiblings',
  'disableAutoplay',
  'skipQuestionOnReplay',
  'maxAnswerSeconds',
  'showTimer',
  'stopTimerOnAnswer',
  'autoShowAnswerSeconds',
  'autoShowQuestionSeconds',
  'waitForAudio',
  'questionAction',
  'answerAction',
  'daysOffMultiplier',
  'fsrsEnabled',
  'maxInterval',
  'startingEase',
  'easyBonus',
  'intervalModifier',
  'hardInterval',
  'lapseMultiplier',
];

/**
 * Resultado da validação de importação.
 */
export type ImportResult =
  | { success: true; preset: DeckPreset }
  | { success: false; error: string };

/**
 * Valida e desserializa um JSON de preset exportado.
 * Retorna um DeckPreset completo com um novo ID gerado.
 */
export function deserializePreset(jsonString: string): ImportResult {
  // 1. Tentar parsear JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, error: 'Arquivo inválido: não é um JSON válido.' };
  }

  // 2. Verificar tipo de objeto
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { success: false, error: 'Arquivo inválido: estrutura inesperada.' };
  }

  const data = parsed as Record<string, unknown>;

  // 3. Verificar assinatura do formato
  if (data._format !== 'memorize-preset') {
    return { success: false, error: 'Arquivo inválido: não é um preset do Memorize.' };
  }

  // 4. Verificar versão
  if (typeof data._version !== 'number' || data._version < 1) {
    return { success: false, error: 'Arquivo inválido: versão incompatível.' };
  }

  // 5. Verificar presença do objeto preset
  if (typeof data.preset !== 'object' || data.preset === null) {
    return { success: false, error: 'Arquivo inválido: dados do preset ausentes.' };
  }

  const presetData = data.preset as Record<string, unknown>;

  // 6. Verificar chaves obrigatórias
  const missingKeys = REQUIRED_PRESET_KEYS.filter(
    (key) => !(key in presetData)
  );

  if (missingKeys.length > 0) {
    return {
      success: false,
      error: `Preset incompleto: campos ausentes — ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? ` e mais ${missingKeys.length - 5}` : ''}.`,
    };
  }

  // 7. Validações de tipo para campos críticos
  if (typeof presetData.name !== 'string' || presetData.name.trim() === '') {
    return { success: false, error: 'Preset inválido: nome ausente ou vazio.' };
  }

  if (typeof presetData.newCardsPerDay !== 'number' || presetData.newCardsPerDay < 0) {
    return { success: false, error: 'Preset inválido: "newCardsPerDay" deve ser um número >= 0.' };
  }

  if (!Array.isArray(presetData.daysOffMultiplier) || presetData.daysOffMultiplier.length !== 7) {
    return { success: false, error: 'Preset inválido: "daysOffMultiplier" deve ser um array com 7 valores.' };
  }

  // 8. Gerar novo ID e montar DeckPreset
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);

  const importedPreset: DeckPreset = {
    id: newId,
    ...(presetData as Omit<DeckPreset, 'id'>),
  };

  return { success: true, preset: importedPreset };
}

/**
 * Dispara o download do preset como arquivo .json no navegador.
 */
export function downloadPresetFile(preset: DeckPreset): void {
  const json = serializePreset(preset);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.replace(/[^a-zA-Z0-9À-ÿ\s-_]/g, '').trim().replace(/\s+/g, '-')}-preset.json`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Abre o seletor de arquivo e retorna o conteúdo JSON do arquivo selecionado.
 * Retorna null se o usuário cancelar.
 */
export function openPresetFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };

    // Se o usuário cancelar o diálogo
    input.oncancel = () => resolve(null);

    input.click();
  });
}
