import { describe, it, expect } from 'vitest';
import { serializePreset, deserializePreset, resolveDeckPreset } from './presets';
import { calculateNextReview } from './srs';
import type { Deck, DeckPreset } from '../types';

// ─── Helper ─────────────────────────────────────────────────────────

function samplePreset(overrides: Partial<DeckPreset> = {}): DeckPreset {
  return {
    id: 'test-preset-id',
    name: 'Meu Preset de Teste',
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    newCardsIgnoreReviewLimit: false,
    limitsStartFromParent: false,
    learningSteps: '1m 10m',
    graduatingInterval: 1,
    easyInterval: 4,
    insertionOrder: 'sequential',
    relearningSteps: '10m',
    minimumInterval: 1,
    leechThreshold: 8,
    leechAction: 'tag',
    newCardGrouping: 'deck',
    newCardSorting: 'template',
    newVsReviewOrder: 'mix',
    interdayLearningVsReviewOrder: 'mix',
    reviewSorting: 'dateThenRandom',
    buryNewSiblings: false,
    buryReviewSiblings: false,
    buryLearningSiblings: false,
    disableAutoplay: false,
    skipQuestionOnReplay: false,
    maxAnswerSeconds: 60,
    showTimer: false,
    stopTimerOnAnswer: false,
    autoShowAnswerSeconds: 0,
    autoShowQuestionSeconds: 0,
    waitForAudio: true,
    questionAction: 'showAnswer',
    answerAction: 'skip',
    daysOffMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    fsrsEnabled: false,
    maxInterval: 36500,
    startingEase: 2.5,
    easyBonus: 1.3,
    intervalModifier: 1.0,
    hardInterval: 1.2,
    lapseMultiplier: 0.5,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// serializePreset
// ═════════════════════════════════════════════════════════════════════

describe('serializePreset', () => {
  it('retorna JSON válido', () => {
    const json = serializePreset(samplePreset());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('inclui metadados do formato (_format, _version, _exportedAt)', () => {
    const json = serializePreset(samplePreset());
    const data = JSON.parse(json);

    expect(data._format).toBe('memorize-preset');
    expect(data._version).toBe(1);
    expect(data._exportedAt).toBeDefined();
    expect(typeof data._exportedAt).toBe('string');
  });

  it('NÃO inclui o campo id no preset exportado', () => {
    const json = serializePreset(samplePreset({ id: 'should-be-removed' }));
    const data = JSON.parse(json);

    expect(data.preset.id).toBeUndefined();
  });

  it('preserva todos os campos do preset (exceto id)', () => {
    const original = samplePreset({ name: 'Inglês Avançado', newCardsPerDay: 50 });
    const json = serializePreset(original);
    const data = JSON.parse(json);

    expect(data.preset.name).toBe('Inglês Avançado');
    expect(data.preset.newCardsPerDay).toBe(50);
    expect(data.preset.maxReviewsPerDay).toBe(200);
    expect(data.preset.fsrsEnabled).toBe(false);
    expect(data.preset.daysOffMultiplier).toEqual([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]);
  });

  it('preserva configurações de FSRS customizadas', () => {
    const original = samplePreset({
      fsrsEnabled: true,
      intervalModifier: 1.5,
      maxInterval: 180,
      startingEase: 3.0,
    });
    const json = serializePreset(original);
    const data = JSON.parse(json);

    expect(data.preset.fsrsEnabled).toBe(true);
    expect(data.preset.intervalModifier).toBe(1.5);
    expect(data.preset.maxInterval).toBe(180);
    expect(data.preset.startingEase).toBe(3.0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// deserializePreset — Sucesso (roundtrip)
// ═════════════════════════════════════════════════════════════════════

describe('deserializePreset: Importação bem-sucedida', () => {
  it('roundtrip: exportar → importar preserva todos os dados', () => {
    const original = samplePreset({ name: 'Roundtrip Test', newCardsPerDay: 42 });
    const json = serializePreset(original);
    const result = deserializePreset(json);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.preset.name).toBe('Roundtrip Test');
    expect(result.preset.newCardsPerDay).toBe(42);
    expect(result.preset.maxReviewsPerDay).toBe(200);
    expect(result.preset.daysOffMultiplier).toEqual([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]);
  });

  it('gera um novo ID diferente do original', () => {
    const original = samplePreset({ id: 'original-id' });
    const json = serializePreset(original);
    const result = deserializePreset(json);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.preset.id).toBeDefined();
    expect(result.preset.id).not.toBe('original-id');
    expect(result.preset.id.length).toBeGreaterThan(0);
  });

  it('importar preset com configurações FSRS avançadas', () => {
    const original = samplePreset({
      fsrsEnabled: true,
      intervalModifier: 0.8,
      easyBonus: 2.0,
      lapseMultiplier: 0.3,
    });
    const json = serializePreset(original);
    const result = deserializePreset(json);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.preset.fsrsEnabled).toBe(true);
    expect(result.preset.intervalModifier).toBe(0.8);
    expect(result.preset.easyBonus).toBe(2.0);
    expect(result.preset.lapseMultiplier).toBe(0.3);
  });

  it('importar preset com dias de descanso customizados', () => {
    const original = samplePreset({
      daysOffMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.0],
    });
    const json = serializePreset(original);
    const result = deserializePreset(json);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.preset.daysOffMultiplier).toEqual([1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.0]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// deserializePreset — Erros de validação
// ═════════════════════════════════════════════════════════════════════

describe('deserializePreset: Validação de erros', () => {
  it('rejeita JSON inválido (lixo)', () => {
    const result = deserializePreset('isto não é json!!!');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('não é um JSON válido');
  });

  it('rejeita array (estrutura inesperada)', () => {
    const result = deserializePreset('[]');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('estrutura inesperada');
  });

  it('rejeita null', () => {
    const result = deserializePreset('null');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('estrutura inesperada');
  });

  it('rejeita JSON sem _format', () => {
    const result = deserializePreset(JSON.stringify({ preset: {} }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('não é um preset do Memorize');
  });

  it('rejeita _format errado', () => {
    const result = deserializePreset(JSON.stringify({ _format: 'anki-export', _version: 1, preset: {} }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('não é um preset do Memorize');
  });

  it('rejeita _version inválida', () => {
    const result = deserializePreset(JSON.stringify({ _format: 'memorize-preset', _version: 0, preset: {} }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('versão incompatível');
  });

  it('rejeita _version string', () => {
    const result = deserializePreset(JSON.stringify({ _format: 'memorize-preset', _version: 'abc', preset: {} }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('versão incompatível');
  });

  it('rejeita preset ausente', () => {
    const result = deserializePreset(JSON.stringify({ _format: 'memorize-preset', _version: 1 }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('dados do preset ausentes');
  });

  it('rejeita preset null', () => {
    const result = deserializePreset(JSON.stringify({ _format: 'memorize-preset', _version: 1, preset: null }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('dados do preset ausentes');
  });

  it('rejeita preset com campos obrigatórios faltando', () => {
    const result = deserializePreset(JSON.stringify({
      _format: 'memorize-preset',
      _version: 1,
      preset: { name: 'Incompleto' },
    }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('campos ausentes');
  });

  it('rejeita preset com nome vazio', () => {
    const preset = samplePreset();
    const json = serializePreset(preset);
    const data = JSON.parse(json);
    data.preset.name = '';
    const result = deserializePreset(JSON.stringify(data));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('nome ausente ou vazio');
  });

  it('rejeita preset com nome que é só espaços', () => {
    const preset = samplePreset();
    const json = serializePreset(preset);
    const data = JSON.parse(json);
    data.preset.name = '   ';
    const result = deserializePreset(JSON.stringify(data));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('nome ausente ou vazio');
  });

  it('rejeita preset com newCardsPerDay negativo', () => {
    const preset = samplePreset();
    const json = serializePreset(preset);
    const data = JSON.parse(json);
    data.preset.newCardsPerDay = -5;
    const result = deserializePreset(JSON.stringify(data));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('newCardsPerDay');
  });

  it('rejeita preset com daysOffMultiplier de tamanho errado', () => {
    const preset = samplePreset();
    const json = serializePreset(preset);
    const data = JSON.parse(json);
    data.preset.daysOffMultiplier = [1.0, 1.0, 1.0]; // Só 3 em vez de 7
    const result = deserializePreset(JSON.stringify(data));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('daysOffMultiplier');
  });

  it('rejeita preset com daysOffMultiplier que não é array', () => {
    const preset = samplePreset();
    const json = serializePreset(preset);
    const data = JSON.parse(json);
    data.preset.daysOffMultiplier = 'invalid';
    const result = deserializePreset(JSON.stringify(data));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('daysOffMultiplier');
  });
});

// ═════════════════════════════════════════════════════════════════════
// Múltiplas importações geram IDs únicos
// ═════════════════════════════════════════════════════════════════════

describe('deserializePreset: IDs únicos', () => {
  it('duas importações do mesmo arquivo geram IDs diferentes', () => {
    const json = serializePreset(samplePreset());
    const result1 = deserializePreset(json);
    const result2 = deserializePreset(json);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    if (!result1.success || !result2.success) return;

    expect(result1.preset.id).not.toBe(result2.preset.id);
  });
});

// ═════════════════════════════════════════════════════════════════════
// resolveDeckPreset & Overrides de Algoritmo/Agendamento
// ═════════════════════════════════════════════════════════════════════

describe('resolveDeckPreset & Scheduling overrides', () => {
  const defaultPresetInstance: DeckPreset = samplePreset({
    fsrsEnabled: false,
  });

  // 1. Modificar o preset altera a resolução de todos os baralhos que o usam
  it('quando um preset é modificado, a resolução de todos os baralhos associados reflete a mudança', () => {
    const preset = samplePreset({ id: 'shared-preset', fsrsEnabled: false });
    const deckA: Deck = { id: 'deck-a', name: 'Deck A', description: '', presetId: 'shared-preset', createdAt: 0, updatedAt: 0 };
    const deckB: Deck = { id: 'deck-b', name: 'Deck B', description: '', presetId: 'shared-preset', createdAt: 0, updatedAt: 0 };
    const deckC: Deck = { id: 'deck-c', name: 'Deck C', description: '', presetId: 'shared-preset', createdAt: 0, updatedAt: 0 };

    const resolvedA1 = resolveDeckPreset(deckA, [preset], defaultPresetInstance);
    const resolvedB1 = resolveDeckPreset(deckB, [preset], defaultPresetInstance);
    const resolvedC1 = resolveDeckPreset(deckC, [preset], defaultPresetInstance);

    expect(resolvedA1.fsrsEnabled).toBe(false);
    expect(resolvedB1.fsrsEnabled).toBe(false);
    expect(resolvedC1.fsrsEnabled).toBe(false);

    // Simulando alteração do preset (ex: habilitando FSRS globalmente para este preset)
    const updatedPreset = { ...preset, fsrsEnabled: true };

    const resolvedA2 = resolveDeckPreset(deckA, [updatedPreset], defaultPresetInstance);
    const resolvedB2 = resolveDeckPreset(deckB, [updatedPreset], defaultPresetInstance);
    const resolvedC2 = resolveDeckPreset(deckC, [updatedPreset], defaultPresetInstance);

    expect(resolvedA2.fsrsEnabled).toBe(true);
    expect(resolvedB2.fsrsEnabled).toBe(true);
    expect(resolvedC2.fsrsEnabled).toBe(true);
  });

  // 2. Override em nível de baralho (Esse baralho)
  it('quando um baralho tem override de algoritmo local (Esse baralho), apenas ele é afetado', () => {
    const preset = samplePreset({ id: 'shared-preset', fsrsEnabled: false });
    // Deck A tem override para FSRS
    const deckA: Deck = {
      id: 'deck-a',
      name: 'Deck A',
      description: '',
      presetId: 'shared-preset',
      createdAt: 0,
      updatedAt: 0,
      algoLimitType: 'deck',
      algoLimitValue: 'FSRS'
    };
    // Deck B não tem override
    const deckB: Deck = {
      id: 'deck-b',
      name: 'Deck B',
      description: '',
      presetId: 'shared-preset',
      createdAt: 0,
      updatedAt: 0
    };

    const resolvedA = resolveDeckPreset(deckA, [preset], defaultPresetInstance);
    const resolvedB = resolveDeckPreset(deckB, [preset], defaultPresetInstance);

    // Deck A deve ter FSRS habilitado por conta do override local
    expect(resolvedA.fsrsEnabled).toBe(true);
    // Deck B deve continuar com FSRS desabilitado herdado do preset
    expect(resolvedB.fsrsEnabled).toBe(false);
  });

  // 3. Override de hoje (Somente hoje)
  it('quando um baralho tem override para hoje (Somente hoje), o override é aplicado no mesmo dia e expira no dia seguinte', () => {
    const preset = samplePreset({ id: 'shared-preset', fsrsEnabled: false });
    const deck: Deck = {
      id: 'deck-a',
      name: 'Deck A',
      description: '',
      presetId: 'shared-preset',
      createdAt: 0,
      updatedAt: 0,
      algoLimitType: 'today',
      algoLimitToday: 'FSRS',
      algoLimitTodayDate: '2026-05-27'
    };

    // Caso 1: Mesma data -> Aplica o override FSRS
    const resolvedToday = resolveDeckPreset(deck, [preset], defaultPresetInstance, '2026-05-27');
    expect(resolvedToday.fsrsEnabled).toBe(true);

    // Caso 2: Data diferente -> Ignora o override e volta para o preset (SM-2)
    const resolvedTomorrow = resolveDeckPreset(deck, [preset], defaultPresetInstance, '2026-05-28');
    expect(resolvedTomorrow.fsrsEnabled).toBe(false);
  });

  // 4. Integração do Preset Resolvido com o Roteamento de calculateNextReview
  it('o agendamento calcula com SM-2 ou FSRS baseado nas configurações de override resolvidas', () => {
    const preset = samplePreset({ id: 'shared-preset', fsrsEnabled: false });
    const deckWithFsrsOverride: Deck = {
      id: 'deck-a',
      name: 'Deck A',
      description: '',
      presetId: 'shared-preset',
      createdAt: 0,
      updatedAt: 0,
      algoLimitType: 'deck',
      algoLimitValue: 'FSRS'
    };
    const deckWithoutOverride: Deck = {
      id: 'deck-b',
      name: 'Deck B',
      description: '',
      presetId: 'shared-preset',
      createdAt: 0,
      updatedAt: 0
    };

    const resolvedFsrs = resolveDeckPreset(deckWithFsrsOverride, [preset], defaultPresetInstance);
    const resolvedSm2 = resolveDeckPreset(deckWithoutOverride, [preset], defaultPresetInstance);

    const testCard = {
      id: 'card-1',
      deckId: 'deck-a',
      front: 'Front',
      back: 'Back',
      context: '',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: '',
      createdAt: 0,
      updatedAt: 0
    };

    // Para o deck com override FSRS -> Deve retornar campos de FSRS no agendamento
    const resultFsrs = calculateNextReview(testCard, 3, resolvedFsrs);
    expect(resultFsrs.difficulty).toBeDefined();
    expect(resultFsrs.stability).toBeDefined();

    // Para o deck sem override -> Deve usar SM-2 e não ter campos do FSRS
    const resultSm2 = calculateNextReview(testCard, 3, resolvedSm2);
    expect(resultSm2.difficulty).toBeUndefined();
    expect(resultSm2.stability).toBeUndefined();
  });

  // 5. Cenários adicionais (Edge cases)
  it('retorna o preset padrão se o deck não tiver presetId associado', () => {
    const deck: Deck = { id: 'deck-a', name: 'Deck A', description: '', createdAt: 0, updatedAt: 0 };
    const resolved = resolveDeckPreset(deck, [], defaultPresetInstance);
    expect(resolved.id).toBe(defaultPresetInstance.id);
  });

  it('ignora override de "hoje" se a data do override for inválida ou vazia', () => {
    const preset = samplePreset({ id: 'shared-preset', fsrsEnabled: false });
    const deck: Deck = {
      id: 'deck-a',
      name: 'Deck A',
      description: '',
      presetId: 'shared-preset',
      createdAt: 0,
      updatedAt: 0,
      algoLimitType: 'today',
      algoLimitToday: 'FSRS',
      algoLimitTodayDate: '' // Data vazia
    };

    const resolved = resolveDeckPreset(deck, [preset], defaultPresetInstance, '2026-05-27');
    expect(resolved.fsrsEnabled).toBe(false); // Fallback para o preset
  });
});
