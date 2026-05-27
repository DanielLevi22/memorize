import { describe, it, expect } from 'vitest';
import { uuidToId, IdMapper, calculateChecksum } from './apkgExporter';

describe('apkgExporter: Hashing and Checksums', () => {
  it('uuidToId deve ser determinístico', () => {
    const uuid = '3a0e2451-4768-4ce6-801d-c8611370b952';
    const id1 = uuidToId(uuid);
    const id2 = uuidToId(uuid);
    expect(id1).toBe(id2);
  });

  it('uuidToId deve retornar um inteiro positivo seguro', () => {
    const uuid = '3a0e2451-4768-4ce6-801d-c8611370b952';
    const id = uuidToId(uuid);
    expect(Number.isSafeInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
  });

  it('IdMapper deve alocar e manter IDs determinísticos', () => {
    const mapper = new IdMapper();
    const uuidA = 'uuid-a';
    const uuidB = 'uuid-b';

    const idA1 = mapper.getOrAllocateId(uuidA);
    const idA2 = mapper.getOrAllocateId(uuidA);
    const idB = mapper.getOrAllocateId(uuidB);

    expect(idA1).toBe(idA2);
    expect(idA1).not.toBe(idB);
  });

  it('IdMapper deve alocar IDs únicos em lote', () => {
    const mapper = new IdMapper();
    // O mapper deve alocar IDs únicos em lote
    const ids = Array.from({ length: 100 }, (_, i) => mapper.getOrAllocateId(`uuid-${i}`));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(100);
  });

  it('IdMapper deve preservar IDs numéricos (strings numéricas) diretamente', () => {
    const mapper = new IdMapper();
    const originalAnkiId = "158392019485";
    const mappedId = mapper.getOrAllocateId(originalAnkiId);
    expect(mappedId).toBe(158392019485);
  });

  it('calculateChecksum deve retornar a soma de verificação de 32 bits sem sinal', () => {
    const text1 = 'apple';
    const text2 = 'apple';
    const text3 = 'banana';

    const csum1 = calculateChecksum(text1);
    const csum2 = calculateChecksum(text2);
    const csum3 = calculateChecksum(text3);

    expect(csum1).toBe(csum2);
    expect(csum1).not.toBe(csum3);
    expect(csum1).toBeGreaterThanOrEqual(0);
  });

  it('calculateChecksum deve limpar tags HTML antes do cálculo', () => {
    const clean = 'apple';
    const html = '<div>apple</div>';

    const csumClean = calculateChecksum(clean);
    const csumHtml = calculateChecksum(html);

    expect(csumClean).toBe(csumHtml);
  });
});
