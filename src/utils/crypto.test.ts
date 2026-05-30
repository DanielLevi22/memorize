import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from './crypto';

describe('crypto: Criptografia e Decriptografia de Dados', () => {
  it('deve criptografar e descriptografar corretamente com a senha correta', async () => {
    const originalText = 'Olá! Este é um texto secreto para testar a sincronização criptografada.';
    const password = 'MinhaSenhaSuperSegura123!';

    const envelope = await encryptData(originalText, password);
    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.salt).toBeDefined();
    expect(envelope.iv).toBeDefined();
    expect(envelope.version).toBe('memorize-encrypted-v1');

    const decryptedText = await decryptData(envelope, password);
    expect(decryptedText).toBe(originalText);
  });

  it('deve falhar e lançar erro ao tentar descriptografar com a senha incorreta', async () => {
    const originalText = 'Dados altamente confidenciais.';
    const password = 'senha-correta';
    const wrongPassword = 'senha-incorreta';

    const envelope = await encryptData(originalText, password);

    await expect(decryptData(envelope, wrongPassword)).rejects.toThrow('Senha incorreta ou arquivo de sincronização corrompido.');
  });

  it('deve gerar criptogramas diferentes para a mesma mensagem devido ao sal e iv aleatórios', async () => {
    const text = 'Mensagem estática';
    const password = 'senha';

    const env1 = await encryptData(text, password);
    const env2 = await encryptData(text, password);

    expect(env1.ciphertext).not.toBe(env2.ciphertext);
    expect(env1.salt).not.toBe(env2.salt);
    expect(env1.iv).not.toBe(env2.iv);

    // Ambos devem ser decifráveis com a mesma senha
    const dec1 = await decryptData(env1, password);
    const dec2 = await decryptData(env2, password);
    expect(dec1).toBe(text);
    expect(dec2).toBe(text);
  });

  it('deve suportar grandes volumes de dados (ex: backup JSON completo)', async () => {
    // Simulando um arquivo de backup grande
    const backupMock = {
      decks: Array.from({ length: 50 }, (_, i) => ({ id: `deck-${i}`, name: `Deck ${i}`, createdAt: Date.now() })),
      cards: Array.from({ length: 500 }, (_, i) => ({ id: `card-${i}`, front: `Question ${i}`, back: `Answer ${i}`, ease: 2.5 }))
    };
    
    const originalText = JSON.stringify(backupMock);
    const password = 'backup-password';

    const envelope = await encryptData(originalText, password);
    const decryptedText = await decryptData(envelope, password);

    expect(decryptedText).toBe(originalText);
    const restoredMock = JSON.parse(decryptedText);
    expect(restoredMock.decks.length).toBe(50);
    expect(restoredMock.cards.length).toBe(500);
  });
});
