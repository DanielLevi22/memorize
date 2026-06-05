// Utilitários de Integração com Google Drive REST API v3 usando Google Identity Services (GIS)
import type { EncryptedEnvelope } from './crypto';

let scriptLoadedPromise: Promise<void> | null = null;

/**
 * Carrega dinamicamente o script de autenticação do Google (GIS).
 */
export function loadGisScript(): Promise<void> {
  if (scriptLoadedPromise) return scriptLoadedPromise;

  scriptLoadedPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      scriptLoadedPromise = null;
      reject(new Error('Não foi possível carregar o script do Google. Verifique sua conexão.'));
    };
    document.body.appendChild(script);
  });

  return scriptLoadedPromise;
}

/**
 * Solicita um token de acesso OAuth2 usando o Token Client do Google.
 * Dispara o popup de consentimento do Google.
 */
export function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    loadGisScript()
      .then(() => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response: any) => {
              if (response.error) {
                reject(new Error(`Erro OAuth2: ${response.error_description || response.error}`));
              } else if (response.access_token) {
                resolve(response.access_token);
              } else {
                reject(new Error('Nenhum token de acesso foi retornado do Google.'));
              }
            },
            error_callback: (err: any) => {
              reject(new Error(`Erro no fluxo de autenticação: ${err.message}`));
            },
          });
          client.requestAccessToken({ prompt: 'consent' });
        } catch (err: any) {
          reject(new Error(`Falha ao inicializar autenticação: ${err.message}`));
        }
      })
      .catch(reject);
  });
}

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime: string;
}

/**
 * Procura pelo arquivo 'memorize_backup.enc' no Google Drive do usuário.
 */
export async function findBackupFile(accessToken: string, filename = 'memorize_backup.enc'): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name = '${filename}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error('Erro ao pesquisar arquivo no Drive:', errorDetails);
    throw new Error('Falha ao verificar arquivos no Google Drive.');
  }

  const result = await response.json();
  if (result.files && result.files.length > 0) {
    return result.files[0] as DriveFileInfo;
  }
  return null;
}

/**
 * Faz o download do arquivo de backup encriptado do Drive e retorna o envelope.
 */
export async function downloadBackupFile(accessToken: string, fileId: string): Promise<EncryptedEnvelope> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error('Erro ao baixar arquivo do Drive:', errorDetails);
    throw new Error('Não foi possível ler o arquivo de sincronização do Google Drive.');
  }

  return (await response.json()) as EncryptedEnvelope;
}

/**
 * Cria um novo arquivo de backup encriptado no Google Drive usando multipart upload.
 */
export async function createBackupFile(accessToken: string, envelope: EncryptedEnvelope, filename = 'memorize_backup.enc'): Promise<DriveFileInfo> {
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: filename === 'memorize_backup.enc'
      ? 'Backup criptografado de ponta a ponta do Memorize'
      : 'Backup criptografado da Fila de Mineração do Memorize',
  };

  const boundary = 'memorize_multipart_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(envelope) +
    closeDelimiter;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error('Erro ao criar arquivo no Drive:', errorDetails);
    throw new Error('Falha ao salvar dados de sincronização no Google Drive.');
  }

  return (await response.json()) as DriveFileInfo;
}

/**
 * Sobrescreve/atualiza o conteúdo de um arquivo existente de backup encriptado no Google Drive.
 */
export async function updateBackupFile(
  accessToken: string,
  fileId: string,
  envelope: EncryptedEnvelope
): Promise<void> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error('Erro ao atualizar arquivo no Drive:', errorDetails);
    throw new Error('Falha ao atualizar dados de sincronização no Google Drive.');
  }
}

/**
 * Revoga um token de acesso OAuth2 usando o SDK do Google.
 */
export function revokeToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        (window as any).google.accounts.oauth2.revoke(accessToken, () => {
          resolve();
        });
      } catch (err) {
        console.warn('Erro ao revogar token via Google GIS SDK:', err);
        resolve();
      }
    } else {
      resolve();
    }
  });
}

export interface DriveUserProfile {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

/**
 * Obtém o perfil do usuário do Google Drive usando o access token.
 */
export async function getDriveUserProfile(accessToken: string): Promise<DriveUserProfile> {
  const url = 'https://www.googleapis.com/drive/v3/about?fields=user';
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error('Erro ao buscar perfil do Drive:', errorDetails);
    throw new Error('Falha ao obter perfil do usuário do Google Drive.');
  }

  const result = await response.json();
  if (result.user) {
    return {
      displayName: result.user.displayName || '',
      emailAddress: result.user.emailAddress || '',
      photoLink: result.user.photoLink || '',
    };
  }
  throw new Error('Perfil de usuário não retornado pelo Google.');
}
