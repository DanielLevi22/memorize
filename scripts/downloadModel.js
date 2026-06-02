import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_URL = 'https://huggingface.co/csukuangfj/sherpa-onnx-spleeter-2stems-fp16/resolve/main/accompaniment.fp16.onnx';
const TARGET_DIR = path.join(__dirname, '..', 'public', 'models');
const TARGET_PATH = path.join(TARGET_DIR, 'spleeter_accompaniment.onnx');

// Ensure directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

console.log(`Iniciando o download do modelo Spleeter de: ${MODEL_URL}`);
console.log(`Destino: ${TARGET_PATH}`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // Handle redirect
      if (response.statusCode === 302 || response.statusCode === 301) {
        console.log(`Redirecionando para: ${response.headers.location}`);
        file.close();
        fs.unlinkSync(dest); // Delete empty file
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Falha no download. Código de status: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastPercent = -1;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        
        if (totalSize) {
          const percent = Math.floor((downloadedSize / totalSize) * 100);
          if (percent !== lastPercent && percent % 10 === 0) {
            console.log(`Progresso do Download: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
            lastPercent = percent;
          }
        }
      });

      response.on('end', () => {
        file.end();
        console.log('Download concluído com sucesso!');
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {}); // Clean up
      reject(err);
    });
  });
}

download(MODEL_URL, TARGET_PATH)
  .then(() => {
    console.log('Modelo Spleeter pronto para uso local!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro ao baixar o modelo:', err);
    process.exit(1);
  });
