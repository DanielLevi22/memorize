import { describe, it, expect } from 'vitest';

// CEFR levels in order
const levelsKeys = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface LevelSpec {
  vocabGoal: number;
}

const levelDetailsData: Record<string, LevelSpec> = {
  A1: { vocabGoal: 500 },
  A2: { vocabGoal: 1000 },
  B1: { vocabGoal: 2000 },
  B2: { vocabGoal: 4000 },
  C1: { vocabGoal: 8000 },
  C2: { vocabGoal: 12000 },
};

// Pure logic progression functions (mirroring the page implementation)
function getLevelNodeStatus(
  level: string,
  unlockedLevel: string,
  estimatedLevel: string,
  targetLevel: string
) {
  const index = levelsKeys.indexOf(level);
  const unlockedIdx = levelsKeys.indexOf(unlockedLevel);
  const currentIdx = levelsKeys.indexOf(estimatedLevel);
  const targetIdx = levelsKeys.indexOf(targetLevel);

  const isLocked = index > unlockedIdx;
  
  let status = 'locked';
  if (!isLocked) {
    if (index <= currentIdx) {
      status = 'mastered';
    } else if (index <= targetIdx) {
      status = 'target';
    } else {
      status = 'unlocked';
    }
  }

  return {
    isLocked,
    status
  };
}

function getExamAction(
  level: string,
  unlockedLevel: string,
  studiedCards: number
) {
  const index = levelsKeys.indexOf(level);
  const unlockedIdx = levelsKeys.indexOf(unlockedLevel);
  
  const isLocked = index > unlockedIdx;
  const spec = levelDetailsData[level];
  const hasEnoughVocab = studiedCards >= spec.vocabGoal;

  const action = isLocked ? 'Nivelar-se' : 'Prestar Exame';
  const isEnabled = isLocked || hasEnoughVocab;

  return {
    action,
    isEnabled,
    hasEnoughVocab,
    warning: !isLocked && !hasEnoughVocab ? `Falta estudar ${spec.vocabGoal - studiedCards} cards` : null
  };
}

function handleExamPass(passedLevel: string, currentUnlockedLevel: string) {
  const currentUnlockedIdx = levelsKeys.indexOf(currentUnlockedLevel);
  const examLevelIdx = levelsKeys.indexOf(passedLevel);

  if (examLevelIdx >= currentUnlockedIdx) {
    const nextIdx = examLevelIdx + 1;
    if (nextIdx < levelsKeys.length) {
      return levelsKeys[nextIdx];
    } else {
      return 'C2'; // Mastered all
    }
  }
  return currentUnlockedLevel;
}

describe('CEFR Evolution and Progress Flow Logic', () => {
  describe('Roadmap Node Lock State & Visual Styling', () => {
    it('deve marcar niveis acima do unlockedLevel como locked', () => {
      const unlocked = 'B1'; // A1, A2, B1 unlocked; B2, C1, C2 locked
      
      const nodeA2 = getLevelNodeStatus('A2', unlocked, 'A1', 'B2');
      const nodeB2 = getLevelNodeStatus('B2', unlocked, 'A1', 'B2');

      expect(nodeA2.isLocked).toBe(false);
      expect(nodeB2.isLocked).toBe(true);
    });

    it('deve determinar status do node corretamente baseado na estimativa do usuario e meta', () => {
      const unlocked = 'B2';
      // Usuario esta no A2, quer chegar no B2
      expect(getLevelNodeStatus('A1', unlocked, 'A2', 'B2').status).toBe('mastered');
      expect(getLevelNodeStatus('A2', unlocked, 'A2', 'B2').status).toBe('mastered');
      expect(getLevelNodeStatus('B1', unlocked, 'A2', 'B2').status).toBe('target');
      expect(getLevelNodeStatus('B2', unlocked, 'A2', 'B2').status).toBe('target');
      expect(getLevelNodeStatus('C1', unlocked, 'A2', 'B2').isLocked).toBe(true);
    });
  });

  describe('Exam Action Button & Vocabulary Constraints', () => {
    it('para nivel desbloqueado, deve permitir prestar exame se tiver vocabulario suficiente', () => {
      const unlocked = 'B1';
      // Para o A2 (meta: 1000 cards), se ele tem 1200 cards, pode prestar o exame
      const actionOk = getExamAction('A2', unlocked, 1200);
      expect(actionOk.action).toBe('Prestar Exame');
      expect(actionOk.isEnabled).toBe(true);

      // Se ele tem 500 cards, nao pode prestar o exame
      const actionBlocked = getExamAction('A2', unlocked, 500);
      expect(actionBlocked.action).toBe('Prestar Exame');
      expect(actionBlocked.isEnabled).toBe(false);
      expect(actionBlocked.warning).toContain('Falta estudar 500 cards');
    });

    it('para nivel bloqueado, deve permitir nivelamento (Nivelar-se) sem restricao de vocabulario', () => {
      const unlocked = 'A2';
      // B2 (bloqueado, meta: 4000 cards), com apenas 100 cards estudados
      const actionJump = getExamAction('B2', unlocked, 100);
      expect(actionJump.action).toBe('Nivelar-se');
      expect(actionJump.isEnabled).toBe(true); // Sempre habilitado para saltos/diagnostico
    });
  });

  describe('Progression Rules on Passing Exam', () => {
    it('deve desbloquear o proximo nivel quando passa no exame atual', () => {
      const nextLevel = handleExamPass('A1', 'A1');
      expect(nextLevel).toBe('A2');
    });

    it('deve realizar salto de nivel (diagnostic jump) para o nivel subsequente ao passar em um exame acima', () => {
      // Se usuario esta no A1, mas passa no exame B2 direto, ele desbloqueia ate C1 (meta seguinte ao B2)
      const nextLevel = handleExamPass('B2', 'A1');
      expect(nextLevel).toBe('C1');
    });

    it('nao deve alterar o nivel se passar em um exame de nivel inferior ao maior ja desbloqueado', () => {
      // Usuario ja desbloqueou B2, mas decide refazer o exame A2 e passa
      const nextLevel = handleExamPass('A2', 'B2');
      expect(nextLevel).toBe('B2');
    });

    it('deve travar no C2 se passar no exame C2', () => {
      const nextLevel = handleExamPass('C2', 'C1');
      expect(nextLevel).toBe('C2');
      
      const nextLevelMax = handleExamPass('C2', 'C2');
      expect(nextLevelMax).toBe('C2');
    });
  });
});
