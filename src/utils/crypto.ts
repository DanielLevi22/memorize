// Utilitários de Criptografia usando Web Crypto API (Nativo do Navegador)

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Deriva uma chave de criptografia AES de 256 bits a partir de uma senha e um sal (salt) usando PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedEnvelope {
  salt: string;
  iv: string;
  ciphertext: string;
  version: string;
  updatedAt: number;
}

/**
 * Criptografa dados em texto puro com AES-GCM 256 a partir de uma senha.
 */
export async function encryptData(data: string, password: string): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encoder = new TextEncoder();
  const rawData = encoder.encode(data);

  const key = await deriveKey(password, salt);
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    rawData
  );

  return {
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    version: 'memorize-encrypted-v1',
    updatedAt: Date.now(),
  };
}

/**
 * Descriptografa dados criptografados contidos em um envelope JSON com uma senha.
 */
export async function decryptData(envelope: EncryptedEnvelope, password: string): Promise<string> {
  try {
    const salt = new Uint8Array(base64ToArrayBuffer(envelope.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
    const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

    const key = await deriveKey(password, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err: any) {
    console.error('Falha na decriptografia de dados:', err);
    throw new Error('Senha incorreta ou arquivo de sincronização corrompido.');
  }
}
