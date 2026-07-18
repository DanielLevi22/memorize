/**
 * Cloud Vocal Separation Service
 *
 * Uses free public HuggingFace Gradio Spaces running Demucs (HTDemucs).
 * Uses @gradio/client (official package).
 *
 * Docs: docs/estudo_extracao_vocal.md
 */

import { Client, handle_file } from '@gradio/client';

export interface CloudSeparationResult {
  /** Faixa retornada — vocal isolado ou instrumental, conforme o `outputType` solicitado */
  outputBlob: Blob;
  source: string;
}

const SEPARATION_SPACES: Array<{
  name: string;
  endpoint: string;         // named endpoint from view_api()
  instrumentalOutputIndex: number;
}> = [
  // Endpoint /inference confirmed via view_api():
  // outputs[0] = Vocals, outputs[1] = No Vocals / Instrumental
  { name: 'abidlabs/music-separation', endpoint: '/inference', instrumentalOutputIndex: 1 },
];

/** Converts any error shape to a readable string. */
function toMessage(err: unknown): string {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.toString();
  try { return JSON.stringify(err).slice(0, 400); } catch { return String(err); }
}

export async function separateVocalsCloud(
  audioBlob: Blob,
  onProgress: (progress: number, message: string) => void,
  outputType: 'vocals' | 'instrumental' = 'instrumental'
): Promise<CloudSeparationResult> {
  onProgress(5, 'Iniciando separação via nuvem...');

  const errors: string[] = [];

  for (const space of SEPARATION_SPACES) {
    try {
      console.log(`[VocalCloud] Tentando: ${space.name} (${space.endpoint}) - Solicitado: ${outputType}`);
      onProgress(10, `Conectando a ${space.name}...`);

      // Índice 0 para Vocais (vocals), e space.instrumentalOutputIndex (1) para Instrumental
      const outputIndex = outputType === 'vocals' ? 0 : space.instrumentalOutputIndex;

      const resultBlob = await callSpace(
        space.name,
        space.endpoint,
        outputIndex,
        audioBlob,
        onProgress
      );

      return { outputBlob: resultBlob, source: space.name };
    } catch (err: unknown) {
      const msg = toMessage(err);
      console.error(`[VocalCloud] FALHA em ${space.name}:`, err);
      errors.push(`${space.name}: ${msg}`);
    }
  }

  // A causa concreta vai na PRIMEIRA linha: quem exibe a mensagem costuma mostrar só ela,
  // e o texto genérico anterior escondia o motivo real algumas linhas abaixo.
  throw new Error(
    `Separação indisponível — ${errors.join(' | ')}`
  );
}

async function callSpace(
  spaceName: string,
  endpoint: string,
  instrumentalOutputIndex: number,
  audioBlob: Blob,
  onProgress: (progress: number, message: string) => void
): Promise<Blob> {
  // 1. Conectar
  onProgress(15, 'Conectando ao Space HuggingFace...');
  let client: Awaited<ReturnType<typeof Client.connect>>;
  try {
    client = await Client.connect(spaceName);
  } catch (err: unknown) {
    throw new Error(`falha ao conectar: ${toMessage(err)}`);
  }

  // 2. Inspeção da API apenas para diagnóstico — nunca deve derrubar a separação.
  //    Antes era uma chamada obrigatória cujo único uso era um console.log gigante:
  //    se ela falhasse, a separação inteira falhava junto sem motivo real.
  try {
    const apiInfo: any = await client.view_api();
    console.log('[VocalCloud] Endpoints disponíveis:', Object.keys(apiInfo?.named_endpoints ?? {}));
  } catch (err: unknown) {
    console.warn('[VocalCloud] view_api() indisponível (seguindo mesmo assim):', toMessage(err));
  }

  onProgress(25, 'Enviando arquivo de áudio...');

  // 3. Montar o arquivo. O endpoint declara o parâmetro como FileData (path/url), não como
  //    File cru — `handle_file` faz o upload e devolve a referência no formato esperado.
  //    Passar o Blob direto faz o servidor Gradio rejeitar o payload.
  const audioFile = new File([audioBlob], 'audio.wav', {
    type: audioBlob.type || 'audio/wav',
  });

  onProgress(40, 'Processando com Demucs HTDemucs... (pode levar 1-3 min na fila gratuita)');

  // 4. Chamar o endpoint correto com parâmetro nomeado
  console.log(`[VocalCloud] Chamando predict('${endpoint}', {audio}) — arquivo: ${(audioFile.size / 1024 / 1024).toFixed(1)} MB`);

  let result: Awaited<ReturnType<typeof client.predict>>;
  try {
    // Usa endpoint nomeado (/inference) e parâmetro nomeado {audio}
    // Confirmado via /gradio_api/info: endpoint='/inference', param='audio', tipo FileData
    result = await client.predict(endpoint, { audio: handle_file(audioFile) });
  } catch (err: unknown) {
    console.error('[VocalCloud] predict() falhou:', err);
    throw new Error(`predict() falhou: ${toMessage(err)}`);
  }

  if ((result as any)?.type === 'status' && (result as any)?.stage === 'error') {
    throw new Error(`o Space retornou erro: ${toMessage((result as any).message)}`);
  }

  console.log('[VocalCloud] Resultado bruto:', result);

  onProgress(90, 'Separação concluída! Baixando faixa instrumental...');

  // 5. Extrair o blob do resultado
  const outputs = result?.data;
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new Error(`Resposta inválida: ${JSON.stringify(result)?.slice(0, 300)}`);
  }

  const output = outputs[instrumentalOutputIndex] ?? outputs[0];
  console.log('[VocalCloud] Output instrumental (índice', instrumentalOutputIndex, '):', output);

  return extractBlob(output, spaceName);
}

async function extractBlob(output: unknown, spaceName: string): Promise<Blob> {
  if (output instanceof Blob || output instanceof File) return output as Blob;

  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>;
    const rawUrl = (o.url ?? o.path) as string | undefined;

    if (rawUrl) {
      const url = rawUrl.startsWith('http')
        ? rawUrl
        : `https://${spaceName.replace('/', '-')}.hf.space${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

      console.log('[VocalCloud] Baixando de:', url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao baixar: HTTP ${res.status} ${res.statusText}`);
      return res.blob();
    }
  }

  if (typeof output === 'string') {
    const url = output.startsWith('http')
      ? output
      : `https://${spaceName.replace('/', '-')}.hf.space${output.startsWith('/') ? '' : '/'}${output}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar: HTTP ${res.status} ${res.statusText}`);
    return res.blob();
  }

  throw new Error(
    `Formato de saída desconhecido: ${JSON.stringify(output)?.slice(0, 300)}`
  );
}
