/**
 * Utilitário para realizar o parsing robusto de arquivos CSV/TXT.
 * Suporta detecção automática de delimitador (vírgula, ponto-e-vírgula e tabulações)
 * e tratamento correto para campos protegidos por aspas duplas.
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  // Detecta o delimitador contando ocorrências na primeira linha
  const firstLine = text.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (tabs > semicolons && tabs > commas) {
    delimiter = '\t';
  } else if (semicolons > commas) {
    delimiter = ';';
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Aspas duplas seguidas dentro de aspas equivalem a aspa de escape
          currentValue += '"';
          i++; // pula a segunda aspa
        } else {
          // Fim do campo cotado
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        // Início do campo cotado
        inQuotes = true;
      } else if (char === delimiter) {
        // Fim de coluna
        row.push(currentValue.trim());
        currentValue = '';
      } else if (char === '\n' || char === '\r') {
        // Fim de linha
        if (char === '\r' && nextChar === '\n') {
          i++; // pula a LF se for CRLF
        }
        row.push(currentValue.trim());
        // Apenas adiciona a linha se contiver dados não vazios
        if (row.some(val => val !== '')) {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
  }

  // Adiciona a última linha pendente se houver
  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(val => val !== '')) {
      lines.push(row);
    }
  }

  return lines;
}
