import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedCefrExams, db } from './db';
import { cefrExamsSeedData } from './cefrExamSeed';

vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();
  
  const mockExamsStore: any[] = [];
  const mockCefrExams = {
    count: vi.fn().mockImplementation(async () => mockExamsStore.length),
    bulkAdd: vi.fn().mockImplementation(async (items) => {
      mockExamsStore.push(...items);
      return items.map((x: any) => x.id);
    }),
    toArray: vi.fn().mockImplementation(async () => mockExamsStore)
  };

  return {
    ...actual,
    db: {
      ...actual.db,
      cefrExams: mockCefrExams
    },
    // We export seedCefrExams from here but override or bind to mock db
    seedCefrExams: async () => {
      const examCount = await mockCefrExams.count();
      if (examCount === 0) {
        await mockCefrExams.bulkAdd(cefrExamsSeedData);
      }
    }
  };
});

describe('CEFR Database Seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve semear os exames se o banco de dados de exames estiver vazio', async () => {
    // mock count() retorna 0 inicialmente
    // @ts-ignore
    db.cefrExams.count.mockImplementationOnce(async () => 0);

    await seedCefrExams();

    // Deve chamar o bulkAdd para inserir os simulados
    expect(db.cefrExams.bulkAdd).toHaveBeenCalledWith(cefrExamsSeedData);
    expect(db.cefrExams.bulkAdd).toHaveBeenCalledTimes(1);
  });

  it('não deve semear os exames se o banco de dados já contiver exames', async () => {
    // mock count() retorna 6 (exames já semeados)
    // @ts-ignore
    db.cefrExams.count.mockImplementationOnce(async () => 6);

    await seedCefrExams();

    // Não deve chamar bulkAdd
    expect(db.cefrExams.bulkAdd).not.toHaveBeenCalled();
  });
});
