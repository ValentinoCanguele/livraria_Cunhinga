#!/usr/bin/env node
/**
 * Remove livros de demonstração e importa o catálogo real (CSV + capas).
 * Uso: node scripts/import-catalog.js [--no-purge]
 *
 * Requer PocketBase a correr em http://127.0.0.1:8090
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const CSV_PATH = path.join(repoRoot, 'pb_import/catalogo_livraria_pocketbase_FINAL.csv');
const IMAGES_DIR = path.join(repoRoot, 'pb_import/capas_final_named');

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SUPER_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@livraria.local';
const SUPER_PASS = process.env.PB_ADMIN_PASSWORD || 'Admin123456!';
const noPurge = process.argv.includes('--no-purge');

/** Parser CSV simples (suporta campos entre aspas com vírgulas). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }

  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((key, idx) => [key, cells[idx] ?? ''])));
}

function clean(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v === '' ? null : v;
}

function toNumber(value, fallback = 0) {
  const v = clean(value);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function colportagemNote(row) {
  const parts = [];
  if (row.pc_kz) parts.push(`PC: ${row.pc_kz} Kz`);
  if (row.paginas) parts.push(`${row.paginas} págs`);
  if (row.tamanho) parts.push(row.tamanho);
  if (row.qtd_por_caixa) parts.push(row.qtd_por_caixa);
  if (!parts.length) return '';
  return `[Colportagem] ${parts.join(' · ')}`;
}

function toOptionalNumber(value) {
  const v = clean(value);
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function smartGenre(title, author, rawGenre) {
  const t = `${title || ''} ${author || ''}`.toLowerCase();
  if (/ellen\s*g?\.?\s*white/.test(t)) return 'Ellen G. White';
  if (/apocalipse|profec|daniel|revela|milenar|escatolog|sinais dos tempos/.test(t)) return 'Apocalipse & Profecia';
  if (/saúde|saude|depressão|depressao|vegetarian|alimentação|alimentacao|menopausa|esperança|cura|medicina|viver melhor/.test(t)) return 'Saúde & Estilo de Vida';
  if (/família|familia|namoro|casamento|relacionamento|sexualidade|lua de mel|criança|crianca|filho|pais|mãe|mae/.test(t)) return 'Família & Relacionamentos';
  if (/pregação|pregacao|sermão|sermao|liderança|lideranca|líder|lider|igreja em missão|evangelismo/.test(t)) return 'Pregação & Liderança';
  if (/fé|fe|doutrina|crenças|crencas|justificação|justificacao|sábado|sabado|adventismo|adventista|bíblia|biblia|hermenêutica|hermeneutica|deus|cristo|oração|oracao/.test(t)) return 'Fé & Doutrina';
  if (rawGenre && rawGenre !== 'Catálogo Geral') return rawGenre;
  return 'Catálogo Geral';
}

function rowToBook(row) {
  const code = clean(row.codigo);
  const rawGenre = clean(row.categoria);
  const title = clean(row.titulo) || code;
  const author = clean(row.autor) || '';
  const genre = smartGenre(title, author, rawGenre);
  const stock = toNumber(row.estoque, 0);
  let description = clean(row.descricao) || '';
  const extra = colportagemNote(row);
  if (extra) {
    description = description ? `${extra}\n\n${description}` : extra;
  }

  const book = {
    book_code: code,
    sku: code,
    title,
    author,
    genre,
    price: toNumber(row.preco_kz, 0),
    stock,
    description,
    publisher: 'Livraria e Editora Adventista',
    language: 'Português',
    featured: stock >= 10,
    preview_enabled: false,
    imageFile: clean(row.imagem_arquivo),
  };
  const pages = toOptionalNumber(row.paginas);
  if (pages !== undefined) book.pages = pages;
  return book;
}

async function pbFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${PB_URL}${endpoint}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `${res.status} ${endpoint}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getAuthHeaders() {
  const auth = await pbFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: SUPER_EMAIL, password: SUPER_PASS }),
  });
  return { Authorization: auth.token };
}

async function purgeBooks(headers) {
  let deleted = 0;
  let page = 1;
  while (true) {
    const data = await pbFetch(`${PB_URL}/api/collections/stock_books/records?perPage=200&page=${page}`, { headers });
    if (!data.items?.length) break;
    for (const item of data.items) {
      await pbFetch(`${PB_URL}/api/collections/stock_books/records/${item.id}`, {
        method: 'DELETE',
        headers,
      });
      deleted++;
      process.stdout.write(`\r  Apagados: ${deleted}`);
    }
    if (data.items.length < 200) break;
    page++;
  }
  if (deleted) console.log(`\n  ${deleted} livros removidos.`);
  else console.log('  Nenhum livro anterior para remover.');
}

function coverFileUrl(record) {
  if (!record?.cover_image) return '';
  return `${PB_URL}/api/files/stock_books/${record.id}/${record.cover_image}`;
}

async function upsertBook(headers, book, existingByCode) {
  const form = new FormData();
  const scalarFields = [
    'book_code', 'sku', 'title', 'author', 'genre', 'price', 'stock',
    'pages', 'description', 'publisher', 'language', 'featured', 'preview_enabled',
  ];
  for (const key of scalarFields) {
    const value = book[key];
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, String(value));
    }
  }

  const imagePath = book.imageFile ? path.join(IMAGES_DIR, book.imageFile) : '';
  if (book.imageFile && existsSync(imagePath)) {
    const buffer = readFileSync(imagePath);
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    form.append('cover_image', blob, book.imageFile);
  } else if (book.imageFile) {
    console.warn(`  ⚠ Capa em falta: ${book.imageFile}`);
  }

  const existing = existingByCode.get(book.book_code);
  let record;
  if (existing) {
    record = await pbFetch(`${PB_URL}/api/collections/stock_books/records/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: form,
    });
  } else {
    record = await pbFetch(`${PB_URL}/api/collections/stock_books/records`, {
      method: 'POST',
      headers,
      body: form,
    });
  }

  const coverUrl = coverFileUrl(record);
  // Hook PocketBase sincroniza cover a partir de cover_image; PATCH só se ainda faltar.
  if (coverUrl && !record.cover) {
    record = await pbFetch(`${PB_URL}/api/collections/stock_books/records/${record.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover: coverUrl }),
    });
  }
  return { record, created: !existing };
}

async function loadExistingByCode(headers) {
  const map = new Map();
  let page = 1;
  while (true) {
    const data = await pbFetch(`${PB_URL}/api/collections/stock_books/records?perPage=200&page=${page}`, { headers });
    for (const item of data.items || []) {
      if (item.book_code) map.set(item.book_code, item);
    }
    if (!data.items?.length || data.items.length < 200) break;
    page++;
  }
  return map;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(`CSV não encontrado: ${CSV_PATH}`);
  }
  if (!existsSync(IMAGES_DIR)) {
    throw new Error(`Pasta de capas não encontrada: ${IMAGES_DIR}`);
  }

  console.log(`→ PocketBase: ${PB_URL}`);
  const headers = await getAuthHeaders();
  console.log('✓ Autenticado.');

  if (!noPurge) {
    console.log('→ A remover catálogo anterior...');
    await purgeBooks(headers);
  }

  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(csvContent);
  console.log(`→ A importar ${rows.length} livros...`);

  const existingByCode = await loadExistingByCode(headers);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const book = rowToBook(row);
    if (!book.book_code) continue;
    try {
      const result = await upsertBook(headers, book, existingByCode);
      if (result.created) {
        created++;
        console.log(`  + ${book.book_code} — ${book.title}`);
      } else {
        updated++;
        console.log(`  ↻ ${book.book_code} — ${book.title}`);
      }
      existingByCode.set(book.book_code, result.record);
    } catch (err) {
      errors++;
      console.error(`  ✗ ${book.book_code}: ${err.message}`);
    }
  }

  console.log('\n---------------------------------------');
  console.log(`Concluído. Criados: ${created} | Atualizados: ${updated} | Erros: ${errors}`);
  console.log('---------------------------------------');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
