import JSZip from 'jszip';
import type { Deck, Card, Note, Revision } from '../types';

// Função auxiliar para carregar a biblioteca sql.js dinamicamente
const loadSqlJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Ambiente sem suporte a window.'));
      return;
    }
    if ((window as any).initSqlJs) {
      resolve((window as any).initSqlJs);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js';
    script.async = true;
    script.onload = () => {
      resolve((window as any).initSqlJs);
    };
    script.onerror = () => reject(new Error('Falha ao carregar biblioteca SQLite (sql.js).'));
    document.body.appendChild(script);
  });
};

/**
 * Converte um UUID em string de forma determinística para um ID numérico de 64 bits seguro.
 * JavaScript suporta inteiros seguros até 9007199254740991 (2^53 - 1).
 * Esse hash garante que o ID numérico fique dentro dessa faixa e seja sempre positivo.
 */
export function uuidToId(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Converte para inteiro de 32 bits assinado
  }
  // Offset para manter na faixa segura típica de timestamps do Anki
  return Math.abs(hash) + 1600000000000;
}

/**
 * Gera um mapa determinístico e sem colisões de IDs.
 */
export class IdMapper {
  private idMap = new Map<string, number>();
  private allocatedIds = new Set<number>();

  getOrAllocateId(uuid: string): number {
    if (this.idMap.has(uuid)) {
      return this.idMap.get(uuid)!;
    }
    let id: number;
    if (/^\d+$/.test(uuid)) {
      id = parseInt(uuid, 10);
    } else {
      id = uuidToId(uuid);
    }
    while (this.allocatedIds.has(id)) {
      id++;
    }
    this.allocatedIds.add(id);
    this.idMap.set(uuid, id);
    return id;
  }
}

/**
 * Calcula a soma de verificação Anki (checksum de 32 bits) para o primeiro campo.
 * O checksum é feito a partir dos primeiros 8 bytes do hash SHA-1 do campo de ordenação.
 * Para simplificar em JS puro e de forma compatível, usaremos um hash de string de 32 bits simples.
 */
export function calculateChecksum(text: string): number {
  let hash = 0;
  const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "").trim(); // Remove HTML se houver
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) >>> 0; // Garante 32 bits sem sinal
}

/**
 * Retorna as configurações de modelos (Note Types) padrão em formato JSON para o Anki.
 */
function getAnkiModelsJSON(): string {
  const models: { [id: string]: any } = {
    "1600000000001": {
      "id": 1600000000001,
      "name": "Memorize Básico",
      "type": 0,
      "mod": 1600000000000,
      "usn": -1,
      "sortf": 0,
      "did": 1,
      "tmpls": [
        {
          "name": "Cartão 1",
          "ord": 0,
          "qfmt": "<div class=\"front-back\">{{Frente}}</div>",
          "afmt": "<div class=\"front-back\">{{Frente}}</div>\n\n<hr id=\"answer\">\n\n<div class=\"front-back\">{{Verso}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        }
      ],
      "flds": [
        { "name": "Frente", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Verso", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Contexto", "ord": 2, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] }
      ],
      "css": ".card {\n  font-family: system-ui, -apple-system, sans-serif;\n  font-size: 19px;\n  text-align: center;\n  color: #1e293b;\n  background-color: #f8fafc;\n  padding: 30px 20px;\n}\n.front-back {\n  font-weight: 600;\n  line-height: 1.5;\n}\n.context {\n  font-style: italic;\n  color: #64748b;\n  margin-top: 20px;\n  font-size: 14px;\n  padding: 8px 12px;\n  background-color: #f1f5f9;\n  border-radius: 8px;\n  display: inline-block;\n  max-width: 80%;\n}",
      "latexPre": "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\begin{document}\n",
      "latexPost": "\\end{document}",
      "req": [[0, "all", [0]]],
      "tags": [],
      "vers": []
    },
    "1600000000002": {
      "id": 1600000000002,
      "name": "Memorize Reverso",
      "type": 0,
      "mod": 1600000000000,
      "usn": -1,
      "sortf": 0,
      "did": 1,
      "tmpls": [
        {
          "name": "Frente -> Verso",
          "ord": 0,
          "qfmt": "<div class=\"front-back\">{{Frente}}</div>",
          "afmt": "<div class=\"front-back\">{{Frente}}</div>\n\n<hr id=\"answer\">\n\n<div class=\"front-back\">{{Verso}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        },
        {
          "name": "Verso -> Frente",
          "ord": 1,
          "qfmt": "<div class=\"front-back\">{{Verso}}</div>",
          "afmt": "<div class=\"front-back\">{{Verso}}</div>\n\n<hr id=\"answer\">\n\n<div class=\"front-back\">{{Frente}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        }
      ],
      "flds": [
        { "name": "Frente", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Verso", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Contexto", "ord": 2, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] }
      ],
      "css": ".card {\n  font-family: system-ui, -apple-system, sans-serif;\n  font-size: 19px;\n  text-align: center;\n  color: #1e293b;\n  background-color: #f8fafc;\n  padding: 30px 20px;\n}\n.front-back {\n  font-weight: 600;\n  line-height: 1.5;\n}\n.context {\n  font-style: italic;\n  color: #64748b;\n  margin-top: 20px;\n  font-size: 14px;\n  padding: 8px 12px;\n  background-color: #f1f5f9;\n  border-radius: 8px;\n  display: inline-block;\n  max-width: 80%;\n}",
      "latexPre": "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\begin{document}\n",
      "latexPost": "\\end{document}",
      "req": [[0, "all", [0]], [1, "all", [1]]],
      "tags": [],
      "vers": []
    },
    "1600000000003": {
      "id": 1600000000003,
      "name": "Memorize Reverso Opcional",
      "type": 0,
      "mod": 1600000000000,
      "usn": -1,
      "sortf": 0,
      "did": 1,
      "tmpls": [
        {
          "name": "Frente -> Verso",
          "ord": 0,
          "qfmt": "<div class=\"front-back\">{{Frente}}</div>",
          "afmt": "<div class=\"front-back\">{{Frente}}</div>\n\n<hr id=\"answer\">\n\n<div class=\"front-back\">{{Verso}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        },
        {
          "name": "Verso -> Frente",
          "ord": 1,
          "qfmt": "{{#AddReverso}}<div class=\"front-back\">{{Verso}}</div>{{/AddReverso}}",
          "afmt": "{{#AddReverso}}<div class=\"front-back\">{{Verso}}</div>\n\n<hr id=\"answer\">\n\n<div class=\"front-back\">{{Frente}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}{{/AddReverso}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        }
      ],
      "flds": [
        { "name": "Frente", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Verso", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "AddReverso", "ord": 2, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Contexto", "ord": 3, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] }
      ],
      "css": ".card {\n  font-family: system-ui, -apple-system, sans-serif;\n  font-size: 19px;\n  text-align: center;\n  color: #1e293b;\n  background-color: #f8fafc;\n  padding: 30px 20px;\n}\n.front-back {\n  font-weight: 600;\n  line-height: 1.5;\n}\n.context {\n  font-style: italic;\n  color: #64748b;\n  margin-top: 20px;\n  font-size: 14px;\n  padding: 8px 12px;\n  background-color: #f1f5f9;\n  border-radius: 8px;\n  display: inline-block;\n  max-width: 80%;\n}",
      "latexPre": "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\begin{document}\n",
      "latexPost": "\\end{document}",
      "req": [[0, "all", [0]], [1, "all", [2]]],
      "tags": [],
      "vers": []
    },
    "1600000000004": {
      "id": 1600000000004,
      "name": "Memorize Omissão (Cloze)",
      "type": 1,
      "mod": 1600000000000,
      "usn": -1,
      "sortf": 0,
      "did": 1,
      "tmpls": [
        {
          "name": "Omissão",
          "ord": 0,
          "qfmt": "<div class=\"front-back\">{{cloze:Texto}}</div>",
          "afmt": "<div class=\"front-back\">{{cloze:Texto}}</div>\n\n<hr id=\"answer\">\n\n<div class=\"front-back\">{{Extra}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        }
      ],
      "flds": [
        { "name": "Texto", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Extra", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Contexto", "ord": 2, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] }
      ],
      "css": ".card {\n  font-family: system-ui, -apple-system, sans-serif;\n  font-size: 19px;\n  text-align: center;\n  color: #1e293b;\n  background-color: #f8fafc;\n  padding: 30px 20px;\n}\n.front-back {\n  font-weight: 600;\n  line-height: 1.5;\n}\n.cloze {\n  font-weight: bold;\n  color: #3b82f6;\n}\n.context {\n  font-style: italic;\n  color: #64748b;\n  margin-top: 20px;\n  font-size: 14px;\n  padding: 8px 12px;\n  background-color: #f1f5f9;\n  border-radius: 8px;\n  display: inline-block;\n  max-width: 80%;\n}",
      "latexPre": "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\begin{document}\n",
      "latexPost": "\\end{document}",
      "req": [[0, "all", [0]]],
      "tags": [],
      "vers": []
    },
    "1600000000005": {
      "id": 1600000000005,
      "name": "Memorize Digitação",
      "type": 0,
      "mod": 1600000000000,
      "usn": -1,
      "sortf": 0,
      "did": 1,
      "tmpls": [
        {
          "name": "Digitação",
          "ord": 0,
          "qfmt": "<div class=\"front-back\">{{Frente}}</div>\n\n{{type:Verso}}",
          "afmt": "<div class=\"front-back\">{{Frente}}</div>\n\n<hr id=\"answer\">\n\n{{type:Verso}}\n\n<div class=\"front-back\">{{Verso}}</div>\n\n{{#Contexto}}\n<div class=\"context\">{{Contexto}}</div>\n{{/Contexto}}",
          "did": null,
          "bqfmt": "",
          "bafmt": ""
        }
      ],
      "flds": [
        { "name": "Frente", "ord": 0, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Verso", "ord": 1, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] },
        { "name": "Contexto", "ord": 2, "sticky": false, "rtl": false, "font": "Arial", "size": 20, "media": [] }
      ],
      "css": ".card {\n  font-family: system-ui, -apple-system, sans-serif;\n  font-size: 19px;\n  text-align: center;\n  color: #1e293b;\n  background-color: #f8fafc;\n  padding: 30px 20px;\n}\n.front-back {\n  font-weight: 600;\n  line-height: 1.5;\n}\n.context {\n  font-style: italic;\n  color: #64748b;\n  margin-top: 20px;\n  font-size: 14px;\n  padding: 8px 12px;\n  background-color: #f1f5f9;\n  border-radius: 8px;\n  display: inline-block;\n  max-width: 80%;\n}",
      "latexPre": "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\begin{document}\n",
      "latexPost": "\\end{document}",
      "req": [[0, "all", [0]]],
      "tags": [],
      "vers": []
    }
  };
  return JSON.stringify(models);
}

/**
 * Converte um baralho e seus dados do Memorize em um blob binário de pacote APKG do Anki.
 */
export async function exportDeckToApkg(
  deck: Deck,
  notes: Note[],
  cards: Card[],
  revisions: Revision[],
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const mapper = new IdMapper();

  onProgress?.('Carregando biblioteca SQLite...');
  const initSqlJs = await loadSqlJs();
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
  });

  onProgress?.('Inicializando banco de dados SQLite...');
  const dbSql = new SQL.Database();

  // 1. Criar Tabelas Necessárias
  dbSql.run(`
    CREATE TABLE col (
      id              integer primary key,
      crt             integer not null,
      mod             integer not null,
      scm             integer not null,
      ver             integer not null,
      dty             integer not null,
      usn             integer not null,
      ls              integer not null,
      conf            text not null,
      models          text not null,
      decks           text not null,
      dconf           text not null,
      tags            text not null
    );

    CREATE TABLE notes (
      id              integer primary key,
      guid            text not null,
      mid             integer not null,
      mod             integer not null,
      usn             integer not null,
      tags            text not null,
      flds            text not null,
      sfld            text not null,
      csum            integer not null,
      flags           integer not null,
      data            text not null
    );

    CREATE TABLE cards (
      id              integer primary key,
      nid             integer not null,
      did             integer not null,
      ord             integer not null,
      mod             integer not null,
      usn             integer not null,
      type            integer not null,
      queue           integer not null,
      due             integer not null,
      ivl             integer not null,
      factor          integer not null,
      reps            integer not null,
      lapses          integer not null,
      left            integer not null,
      odue            integer not null,
      odid            integer not null,
      flags           integer not null,
      data            text not null
    );

    CREATE TABLE revlog (
      id              integer primary key,
      cid             integer not null,
      usn             integer not null,
      ease            integer not null,
      ivl             integer not null,
      lastIvl         integer not null,
      factor          integer not null,
      time            integer not null,
      type            integer not null
    );

    CREATE TABLE graves (
      usn             integer not null,
      oid             integer not null,
      type            integer not null
    );

    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
  `);

  onProgress?.('Preparando metadados do Anki...');
  const crtTimestamp = Math.floor(deck.createdAt / 1000) || Math.floor(Date.now() / 1000);
  const deckId = mapper.getOrAllocateId(deck.id);

  // JSON do Baralho
  const decksConfig: { [id: string]: any } = {
    "1": {
      "id": 1,
      "name": "Default",
      "mod": Math.floor(Date.now() / 1000),
      "usn": 0,
      "lrnToday": [0, 0],
      "revToday": [0, 0],
      "newToday": [0, 0],
      "timeToday": [0, 0],
      "collapsed": false,
      "desc": "",
      "dyn": 0,
      "conf": 1,
      "extendNew": 10,
      "extendRev": 50
    }
  };
  decksConfig[deckId.toString()] = {
    "id": deckId,
    "name": deck.name,
    "mod": Math.floor(deck.updatedAt / 1000) || Math.floor(Date.now() / 1000),
    "usn": -1,
    "lrnToday": [0, 0],
    "revToday": [0, 0],
    "newToday": [0, 0],
    "timeToday": [0, 0],
    "collapsed": false,
    "desc": deck.description || "",
    "dyn": 0,
    "conf": 1,
    "extendNew": 10,
    "extendRev": 50
  };

  const defaultConf = JSON.stringify({
    "nextIvl": true,
    "activeDecks": [deckId],
    "addToCur": true,
    "collapseTime": 1200,
    "curDeck": deckId,
    "curModel": "1600000000001",
    "dueCounts": true,
    "estTimes": true,
    "newSpread": 0,
    "timeLim": 0
  });

  const defaultDconf = JSON.stringify({
    "1": {
      "id": 1,
      "name": "Default",
      "mod": Math.floor(Date.now() / 1000),
      "usn": 0,
      "maxTaken": 60,
      "autoplay": true,
      "timer": 0,
      "replayq": true,
      "new": {
        "delays": [1.0, 10.0],
        "ints": [1, 4, 0],
        "initialFactor": 2500,
        "order": 1,
        "perDay": 20
      },
      "rev": {
        "perDay": 200,
        "fuzz": 0.05,
        "ivlFct": 1.0,
        "maxIvl": 36500,
        "ease4": 1.3,
        "hardFactor": 1.2
      },
      "lapse": {
        "delays": [10.0],
        "mult": 0.0,
        "minInt": 1,
        "leechFails": 8,
        "leechAction": 0
      },
      "dyn": false
    }
  });

  // Salvar linha única da tabela `col`
  dbSql.run(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      crtTimestamp,
      Date.now(),
      Date.now(),
      11,
      0,
      0,
      0,
      defaultConf,
      getAnkiModelsJSON(),
      JSON.stringify(decksConfig),
      defaultDconf,
      "{}"
    ]
  );

  const zip = new JSZip();
  const mediaMap: { [key: string]: string } = {};
  let mediaIndex = 0;

  // Garantir que todas as notas correspondentes aos cartões existam na exportação (backfill se necessário)
  const notesMap = new Map<string, Note>();
  notes.forEach(n => notesMap.set(n.id, n));

  const allNotes = [...notes];
  for (const card of cards) {
    const noteIdToUse = card.noteId || `gen-note-${card.id}`;
    if (!card.noteId) {
      card.noteId = noteIdToUse;
    }
    if (!notesMap.has(noteIdToUse)) {
      const generatedNote: Note = {
        id: noteIdToUse,
        deckId: deck.id,
        type: 'basic',
        fields: [card.front, card.back],
        tags: card.tags || [],
        audio: card.audio,
        context: card.context || '',
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      };
      notesMap.set(noteIdToUse, generatedNote);
      allNotes.push(generatedNote);
    }
  }

  onProgress?.(`Mapeando ${allNotes.length} notas...`);

  // 2. Inserir Notas no SQLite
  for (const note of allNotes) {
    const noteIdNumeric = mapper.getOrAllocateId(note.id);
    // Guid de 10 caracteres
    const guid = note.id.substring(0, 10);
    
    // Model ID
    let modelId = 1600000000001; // Básico padrão
    if (note.type === 'reversed') modelId = 1600000000002;
    else if (note.type === 'optional_reversed') modelId = 1600000000003;
    else if (note.type === 'cloze') modelId = 1600000000004;
    else if (note.type === 'typing') modelId = 1600000000005;

    // Tratar tags e áudio
    const tagsString = (note.tags || []).map(t => t.replace(/\s+/g, "_")).join(" ");
    let soundTag = '';

    if (note.audio) {
      const soundFilename = `memorize_audio_${note.id}.mp3`;
      soundTag = ` [sound:${soundFilename}]`;

      // Salvar Blob de áudio no JSZip com o índice de mídia
      try {
        const arrayBuffer = await note.audio.arrayBuffer();
        zip.file(mediaIndex.toString(), arrayBuffer);
        mediaMap[mediaIndex.toString()] = soundFilename;
        mediaIndex++;
      } catch (err) {
        console.warn('Erro ao ler áudio da nota ' + note.id, err);
      }
    }

    // Campos da Nota unidos por unit separator (\x1f)
    // 0 = Frente/Texto, 1 = Verso/Extra, 2 = AddReverso (se optional), 3 = Contexto
    let fieldsArray: string[] = [];
    if (note.type === 'optional_reversed') {
      fieldsArray = [
        (note.fields[0] || '') + soundTag,
        note.fields[1] || '',
        note.fields[2] || '',
        note.context || ''
      ];
    } else {
      fieldsArray = [
        (note.fields[0] || '') + soundTag,
        note.fields[1] || '',
        note.context || ''
      ];
    }

    const flds = fieldsArray.join('\x1f');
    const sfld = fieldsArray[0] || '';
    const csum = calculateChecksum(sfld);

    dbSql.run(
      `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        noteIdNumeric,
        guid,
        modelId,
        Math.floor(note.updatedAt / 1000),
        -1,
        tagsString,
        flds,
        sfld,
        csum,
        0,
        ""
      ]
    );
  }

  onProgress?.(`Mapeando ${cards.length} cartões...`);

  // Ordenar cartões por data de criação crescente para preservar a sequência original de inserção
  const sortedCards = [...cards].sort((a, b) => a.createdAt - b.createdAt);
  let newCardIndex = 1;

  // 3. Inserir Cartões no SQLite
  for (const card of sortedCards) {
    const cardIdNumeric = mapper.getOrAllocateId(card.id);
    const noteIdNumeric = card.noteId ? mapper.getOrAllocateId(card.noteId) : 0;

    // Calcular ord
    let ord = 0;
    if (card.cardType === 'reversed') {
      ord = 1;
    } else if (card.clozeIndex !== undefined) {
      ord = card.clozeIndex - 1; // ord de cloze é zero-indexado
    }

    // Determinar type de cartão (Anki: 0=new, 1=learning, 2=review, 3=relearning)
    let type = 0; // novo por padrão
    let queue = 0; // novo por padrão

    if (card.suspended) {
      queue = -1;
    } else if (card.learningStep !== undefined) {
      type = 1;
      queue = 1;
    } else if (card.interval > 0) {
      if (card.repetitions > 1) {
        type = 2; // review
        queue = 2;
      } else {
        type = 1; // learning/relearning
        queue = 1;
      }
    }

    // Calcular due
    let due = 0;
    if (queue === 2) {
      // Para revisões, o Anki salva a data de vencimento como um inteiro de dias desde crt
      const crtDate = new Date(crtTimestamp * 1000);
      crtDate.setUTCHours(0, 0, 0, 0);

      const dueDate = new Date(card.dueDate);
      dueDate.setUTCHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - crtDate.getTime();
      due = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } else if (queue === 1) {
      // Para learning, o Anki salva como um timestamp unix em segundos
      due = Math.floor(new Date(card.dueDate).getTime() / 1000) || Math.floor(Date.now() / 1000);
    } else {
      // Para novos, a fila de exibição deve ser um número sequencial único para preservar a ordem
      due = newCardIndex++;
    }

    const factor = Math.floor(card.ease * 1000) || 2500;
    const interval = card.interval || 0;

    dbSql.run(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cardIdNumeric,
        noteIdNumeric,
        deckId,
        ord,
        Math.floor(card.updatedAt / 1000),
        -1,
        type,
        queue,
        due,
        interval,
        factor,
        card.repetitions,
        card.lapses,
        0,
        0,
        0,
        0,
        ""
      ]
    );
  }

  onProgress?.(`Mapeando histórico de revisões (${revisions.length})...`);

  const allocatedRevIds = new Set<number>();

  // 4. Inserir Histórico de Revisões
  for (const rev of revisions) {
    let revIdNumeric = rev.timestamp;
    while (allocatedRevIds.has(revIdNumeric)) {
      revIdNumeric++;
    }
    allocatedRevIds.add(revIdNumeric);

    const cardIdNumeric = mapper.getOrAllocateId(rev.cardId);

    // Mapeamento de notas de feedback do Anki
    // Anki revlog ease: 1=Again, 2=Hard, 3=Good, 4=Easy
    const ease = rev.rating || 3;
    const ivl = rev.interval || 0;
    const factor = Math.floor(rev.ease * 1000) || 2500;
    const durationMs = Math.floor((rev.duration || 10) * 1000);

    dbSql.run(
      `INSERT INTO revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        revIdNumeric,
        cardIdNumeric,
        -1,
        ease,
        ivl,
        0, // lastIvl padrão
        factor,
        durationMs,
        ivl > 0 ? 1 : 0 // 1=review, 0=learn/new
      ]
    );
  }

  onProgress?.('Exportando banco de dados SQLite...');
  const dbBuffer = dbSql.export();
  zip.file('collection.anki2', dbBuffer);

  // Adicionar arquivo 'media' do Anki contendo o mapa de strings JSON
  zip.file('media', JSON.stringify(mediaMap));

  onProgress?.('Compactando pacote de exportação (.apkg)...');
  const apkgBlob = await zip.generateAsync({ type: 'blob' });
  
  onProgress?.('Exportação concluída com sucesso!');
  return apkgBlob;
}
