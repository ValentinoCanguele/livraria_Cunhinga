#!/usr/bin/env node
/**
 * Copia os dados do PocketBase local para o Supabase.
 *
 * Usa a Edge Function temporária "migrar-dados" (com a service role no servidor),
 * por isso a chave service_role nunca sai do Supabase.
 *
 * Variáveis:
 *   SUPABASE_URL          https://<ref>.supabase.co
 *   MIGRATION_TOKEN       token da função migrar-dados
 *   PB_URL                (opcional) http://127.0.0.1:8090
 *   PB_ADMIN_EMAIL        (opcional) superuser do PocketBase
 *   PB_ADMIN_PASSWORD     (opcional)
 *   PB_DB                 (opcional) caminho do data.db (para as passwords dos utilizadores)
 *
 * Uso: node scripts/migrar-pocketbase-supabase.mjs
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.MIGRATION_TOKEN || '';
const PB_URL = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const PB_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@livraria.local';
const PB_PASS = process.env.PB_ADMIN_PASSWORD || 'Admin123456!';
const PB_DB = process.env.PB_DB || path.join(root, 'app/pocketbase/pb_data/data.db');

if (!SUPABASE_URL || !TOKEN) {
  console.error('Defina SUPABASE_URL e MIGRATION_TOKEN.');
  process.exit(1);
}

const FN = `${SUPABASE_URL}/functions/v1/migrar-dados`;
const PUBLIC_MEDIA = `${SUPABASE_URL}/storage/v1/object/public/media`;

// Ordem respeita as chaves estrangeiras.
const TABLES = [
  'angola_provinces', 'angola_municipalities', 'angola_localities',
  'stock_books', 'book_collections', 'hero_slides', 'physical_stores', 'payment_methods',
  'site_settings', 'app_integrations', 'newsletter', 'orders',
  'contacts', 'contact_groups', 'contact_campaigns', 'contact_notifications', 'push_subscriptions',
];

async function fn(action, { body, params = {}, headers = {} } = {}) {
  const qs = new URLSearchParams({ action, ...params });
  const res = await fetch(`${FN}?${qs}`, {
    method: 'POST',
    headers: { 'x-import-token': TOKEN, ...headers },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`${action}: ${data.error || res.status}`);
  return data;
}

async function pb(pathname, token) {
  const res = await fetch(`${PB_URL}${pathname}`, { headers: token ? { Authorization: token } : {} });
  if (!res.ok) throw new Error(`PocketBase ${pathname}: ${res.status}`);
  return res.json();
}

async function pbAuth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login no PocketBase falhou.');
  return data.token;
}

const fileUrlPattern = /https?:\/\/(?:127\.0\.0\.1|localhost):8090\/api\/files\/([^/]+)\/([^/]+)\/([^?"'\s]+)(\?[^"'\s]*)?/g;

function rewriteFileUrls(value, colNames) {
  if (typeof value !== 'string' || !value.includes('/api/files/')) return value;
  return value.replace(fileUrlPattern, (_m, col, id, file) => `${PUBLIC_MEDIA}/${colNames[col] || col}/${id}/${file}`);
}

function guessType(file) {
  const ext = file.split('.').pop().toLowerCase();
  return {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
  }[ext] || 'application/octet-stream';
}

async function copyFile(token, colName, recordId, file, destPath) {
  const res = await fetch(`${PB_URL}/api/files/${colName}/${recordId}/${encodeURIComponent(file)}?token=`, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    console.warn(`  ! ficheiro em falta: ${colName}/${recordId}/${file} (${res.status})`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fn('file', { body: buf, params: { path: destPath }, headers: { 'Content-Type': guessType(file) } });
  return true;
}

async function main() {
  const token = await pbAuth();
  const { items: collections } = await pb('/api/collections?perPage=200', token);
  const byName = Object.fromEntries(collections.map((c) => [c.name, c]));
  const colNames = Object.fromEntries(collections.flatMap((c) => [[c.id, c.name], [c.name, c.name]]));

  // 1) Utilizadores → Supabase Auth (mantém as passwords bcrypt)
  console.log('Utilizadores…');
  const usersRaw = execFileSync('sqlite3', ['-readonly', '-json', PB_DB,
    'select id, email, password, name, role, phone, avatar, permissions from users'], { encoding: 'utf8' });
  const users = usersRaw.trim() ? JSON.parse(usersRaw) : [];
  const userMap = {};
  for (const u of users) {
    const { id } = await fn('user', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pb_id: u.id,
        email: u.email,
        password_hash: u.password,
        name: u.name || '',
        role: u.role || 'member',
        phone: u.phone || '',
        avatar: u.avatar || '',
        permissions: u.permissions ? JSON.parse(u.permissions) : null,
      }),
    });
    userMap[u.id] = id;
    if (u.avatar) await copyFile(token, 'users', u.id, u.avatar, `users/${id}/${u.avatar}`);
    console.log(`  ${u.email} → ${id}`);
  }

  // 2) Tabelas
  for (const table of TABLES) {
    const col = byName[table];
    if (!col) continue;
    const fields = col.fields.filter((f) => !f.system || f.name === 'id');
    const fileFields = fields.filter((f) => f.type === 'file').map((f) => f.name);
    const userRelations = fields
      .filter((f) => f.type === 'relation' && colNames[f.collectionId] === 'users')
      .map((f) => f.name);
    const otherRelations = fields
      .filter((f) => f.type === 'relation' && colNames[f.collectionId] !== 'users')
      .map((f) => f.name);
    const dateFields = fields.filter((f) => f.type === 'date').map((f) => f.name);

    const { items } = await pb(`/api/collections/${table}/records?perPage=1000`, token);
    const rows = items.map((rec) => {
      const row = { id: rec.id, created: rec.created, updated: rec.updated };
      for (const f of fields) {
        if (f.name === 'id' || f.type === 'autodate') continue;
        let v = rec[f.name];
        if (Array.isArray(v) && (f.type === 'file' || f.type === 'relation')) v = v[0] || '';
        if (dateFields.includes(f.name) && !v) v = null;
        if (userRelations.includes(f.name)) v = v ? (userMap[v] || null) : null;
        else if (otherRelations.includes(f.name) && !v) v = null;
        row[f.name] = rewriteFileUrls(v, colNames);
      }
      return row;
    });

    const batch = table === 'orders' ? 5 : 100;
    for (let i = 0; i < rows.length; i += batch) {
      await fn('rows', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, rows: rows.slice(i, i + batch) }),
      });
    }

    let files = 0;
    for (const rec of items) {
      for (const field of fileFields) {
        const name = Array.isArray(rec[field]) ? rec[field][0] : rec[field];
        if (name && await copyFile(token, table, rec.id, name, `${table}/${rec.id}/${name}`)) files++;
      }
    }
    const { count } = await fn('count', { params: { table } });
    console.log(`${table}: ${rows.length} registos (${count} no Supabase)${files ? `, ${files} ficheiros` : ''}`);
  }
  console.log('Migração concluída.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
