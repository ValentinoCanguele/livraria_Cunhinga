/**
 * Cliente de dados com a mesma API do SDK do PocketBase (collection().getList/getFullList/
 * getOne/getFirstListItem/create/update/delete, files.getURL e authStore), implementado
 * sobre o Supabase. Permitiu migrar o backend sem reescrever cada ecrã.
 *
 * - Colecções = tabelas com o mesmo nome ("users" corresponde a "profiles").
 * - Filtros no formato do PocketBase (=, !=, >, >=, <, <=, ~, !~, &&, ||, parênteses).
 * - Ficheiros vão para o bucket "media" em <colecção>/<id>/<ficheiro>; a coluna guarda o nome.
 */
import { supabase, mediaUrl, APP_API_URL } from '@/lib/supabaseClient';
import { createReadyGate } from '@/lib/authSession';

const TABLE_FOR = { users: 'profiles' };

const FILE_FIELDS = {
  stock_books: ['cover_image'],
  site_settings: ['logo', 'favicon'],
  payment_methods: ['qr_code'],
  book_collections: ['cover_image'],
  physical_stores: ['image'],
  users: ['avatar'],
};

// Campos de relação, para "expand".
const RELATIONS = {
  angola_municipalities: { province: 'angola_provinces' },
  angola_localities: { municipality: 'angola_municipalities' },
  contact_campaigns: { group: 'contact_groups' },
  contact_notifications: { contact: 'contacts', group: 'contact_groups', campaign: 'contact_campaigns' },
};

// Ao enviar um ficheiro, o PocketBase actualizava também o campo de URL correspondente.
const FILE_URL_MIRROR = { stock_books: { cover_image: 'cover' } };

const PROFILE_COLUMNS = ['name', 'avatar', 'role', 'permissions', 'phone'];

export class DataError extends Error {
  constructor(message, status = 400, data = {}) {
    super(message);
    this.status = status;
    this.data = { message, data };
    this.response = this.data;
  }
}

function toDataError(error, fallbackStatus = 400) {
  if (error instanceof DataError) return error;
  const status = error?.code === 'PGRST116' ? 404 : Number(error?.status) || fallbackStatus;
  let message = error?.message || 'Erro desconhecido';
  if (error?.code === '23505') message = 'Já existe um registo com esse valor.';
  if (error?.code === '42501') message = 'Sem permissão para esta operação.';
  return new DataError(message, status, error);
}

// ---------------------------------------------------------------------------
// Filtros do PocketBase → filtros do PostgREST
// ---------------------------------------------------------------------------
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { tokens.push({ t: c }); i++; continue; }
    if (input.startsWith('&&', i) || input.startsWith('||', i)) { tokens.push({ t: input.slice(i, i + 2) }); i += 2; continue; }
    const op = ['!~', '!=', '>=', '<=', '=', '>', '<', '~'].find((o) => input.startsWith(o, i));
    if (op) { tokens.push({ t: 'op', v: op }); i += op.length; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < input.length && input[j] !== c) {
        if (input[j] === '\\' && j + 1 < input.length) { s += input[j + 1]; j += 2; continue; }
        s += input[j++];
      }
      tokens.push({ t: 'val', v: s });
      i = j + 1;
      continue;
    }
    const m = /^[^\s()=!<>~&|]+/.exec(input.slice(i));
    if (!m) throw new DataError(`Filtro inválido: ${input}`);
    const word = m[0];
    if (word === 'true' || word === 'false') tokens.push({ t: 'val', v: word === 'true' });
    else if (word === 'null') tokens.push({ t: 'val', v: null });
    else if (/^-?\d+(\.\d+)?$/.test(word)) tokens.push({ t: 'val', v: Number(word) });
    else tokens.push({ t: 'id', v: word });
    i += word.length;
  }
  return tokens;
}

function parseFilter(input) {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  function primary() {
    const tok = next();
    if (!tok) throw new DataError(`Filtro incompleto: ${input}`);
    if (tok.t === '(') {
      const node = expr();
      next();
      return node;
    }
    const opTok = next();
    const valTok = next();
    if (tok.t !== 'id' || opTok?.t !== 'op' || !valTok) throw new DataError(`Filtro inválido: ${input}`);
    // "a = b" com identificador à direita não é usado pela app; trata como texto.
    return { field: tok.v, op: opTok.v, value: valTok.t === 'id' ? valTok.v : valTok.v };
  }
  function andExpr() {
    const items = [primary()];
    while (peek()?.t === '&&') { next(); items.push(primary()); }
    return items.length === 1 ? items[0] : { and: items };
  }
  function expr() {
    const items = [andExpr()];
    while (peek()?.t === '||') { next(); items.push(andExpr()); }
    return items.length === 1 ? items[0] : { or: items };
  }
  const tree = expr();
  if (pos < tokens.length) throw new DataError(`Filtro inválido: ${input}`);
  return tree;
}

function leafParts({ field, op, value }) {
  if (value === null) {
    if (op === '=') return [field, 'is', null];
    if (op === '!=') return [field, 'not.is', null];
  }
  const likeValue = (v) => {
    const s = String(v ?? '');
    return s.includes('%') ? s.replace(/%/g, '*') : `*${s}*`;
  };
  switch (op) {
    case '=': return [field, 'eq', value];
    case '!=': return [field, 'neq', value];
    case '>': return [field, 'gt', value];
    case '>=': return [field, 'gte', value];
    case '<': return [field, 'lt', value];
    case '<=': return [field, 'lte', value];
    case '~': return [field, 'ilike', likeValue(value)];
    case '!~': return [field, 'not.ilike', likeValue(value)];
    default: throw new DataError(`Operador não suportado: ${op}`);
  }
}

const quoteLogic = (v) => (v === null ? 'null' : typeof v === 'string' ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : String(v));

function toLogic(node) {
  if (node.and) return `and(${node.and.map(toLogic).join(',')})`;
  if (node.or) return `or(${node.or.map(toLogic).join(',')})`;
  const [field, op, value] = leafParts(node);
  return `${field}.${op}.${quoteLogic(value)}`;
}

function applyFilter(query, filter) {
  if (!filter || !String(filter).trim()) return query;
  const tree = parseFilter(String(filter));
  const nodes = tree.and || [tree];
  for (const node of nodes) {
    if (node.or) query = query.or(node.or.map(toLogic).join(','));
    else if (node.and) query = query.or(toLogic(node));
    else {
      const [field, op, value] = leafParts(node);
      query = op.startsWith('not.') ? query.not(field, op.slice(4), value) : query.filter(field, op, value);
    }
  }
  return query;
}

function applySort(query, sort) {
  const parts = String(sort || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) {
    // Ordem de inserção, como o PocketBase sem "sort".
    return query.order('created', { ascending: true }).order('id', { ascending: false });
  }
  for (const part of parts) {
    if (part === '@random') continue;
    const desc = part.startsWith('-');
    query = query.order(part.replace(/^[-+]/, ''), { ascending: !desc });
  }
  return query;
}

// ---------------------------------------------------------------------------
// Registos
// ---------------------------------------------------------------------------
function decorate(collection, row) {
  if (!row) return row;
  const rec = { ...row, collectionName: collection, collectionId: collection };
  if (collection === 'users') {
    rec.verified = true;
    delete rec.pb_id;
  }
  return rec;
}

async function attachExpand(collection, records, expand) {
  if (!expand || !records.length) return records;
  const rel = RELATIONS[collection] || {};
  for (const field of String(expand).split(',').map((s) => s.trim()).filter(Boolean)) {
    const table = rel[field];
    if (!table) continue;
    const ids = [...new Set(records.map((r) => r[field]).filter(Boolean))];
    if (!ids.length) continue;
    const { data } = await supabase.from(table).select('*').in('id', ids);
    const byId = Object.fromEntries((data || []).map((r) => [r.id, decorate(table, r)]));
    for (const r of records) {
      if (r[field] && byId[r[field]]) r.expand = { ...(r.expand || {}), [field]: byId[r[field]] };
    }
  }
  return records;
}

function isFileValue(v) {
  return (typeof File !== 'undefined' && v instanceof File) || (typeof Blob !== 'undefined' && v instanceof Blob);
}

function formDataToObject(fd) {
  const out = {};
  for (const [k, v] of fd.entries()) {
    const key = k.replace(/[+-]$/, '');
    out[key] = v;
  }
  return out;
}

function safeFileName(file) {
  const original = file?.name || 'ficheiro';
  const dot = original.lastIndexOf('.');
  const base = (dot > 0 ? original.slice(0, dot) : original)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'ficheiro';
  const ext = dot > 0 ? original.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  return `${base}_${Math.random().toString(36).slice(2, 12)}.${ext}`;
}

function storagePrefix(collection, id) {
  return `${collection}/${id}`;
}

async function uploadFile(collection, id, file) {
  const name = safeFileName(file);
  const { error } = await supabase.storage.from('media').upload(`${storagePrefix(collection, id)}/${name}`, file, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) throw toDataError(error);
  return name;
}

async function removeFile(collection, id, name) {
  if (!name) return;
  await supabase.storage.from('media').remove([`${storagePrefix(collection, id)}/${name}`]).catch(() => {});
}

/** Separa ficheiros (File/Blob ou null em campos de ficheiro) dos restantes campos. */
function splitPayload(collection, data) {
  const body = data instanceof FormData ? formDataToObject(data) : { ...(data || {}) };
  const fileFields = FILE_FIELDS[collection] || [];
  const files = {};
  for (const [k, v] of Object.entries(body)) {
    if (isFileValue(v)) { files[k] = v; delete body[k]; }
    else if (fileFields.includes(k) && (v === null || v === '')) { files[k] = null; delete body[k]; }
  }
  return { body, files };
}

async function applyFiles(collection, id, files, previous) {
  const patch = {};
  for (const [field, value] of Object.entries(files)) {
    const old = previous?.[field];
    if (value === null) {
      await removeFile(collection, id, old);
      patch[field] = '';
    } else {
      patch[field] = await uploadFile(collection, id, value);
      if (old && old !== patch[field]) await removeFile(collection, id, old);
      const mirror = FILE_URL_MIRROR[collection]?.[field];
      if (mirror) patch[mirror] = mediaUrl(collection, id, patch[field]);
    }
  }
  return patch;
}

async function appApi(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${APP_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError(out.message || 'Erro no servidor', res.status, out);
  return out;
}

// ---------------------------------------------------------------------------
// authStore (sessão do Supabase Auth com o perfil em public.profiles)
// ---------------------------------------------------------------------------
const PROFILE_CACHE_KEY = 'livraria_profile';
const listeners = new Set();

function readCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredSession() {
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  } catch {
    return null;
  }
}

const authStore = {
  token: '',
  record: null,
  get model() { return this.record; },
  get isValid() { return !!this.token && !!this.record; },
  onChange(callback, fireImmediately = false) {
    listeners.add(callback);
    if (fireImmediately) callback(this.token, this.record);
    return () => listeners.delete(callback);
  },
  clear() {
    setAuth('', null);
    supabase.auth.signOut().catch(() => {});
  },
  /** `true` quando o arranque já determinou se existe sessão (com ou sem utilizador). */
  get isReady() { return authGate.ready; },
  onReady(callback) { return authGate.onReady(callback); },
};

function setAuth(token, record) {
  const changed = authStore.token !== token || JSON.stringify(authStore.record) !== JSON.stringify(record);
  authStore.token = token;
  authStore.record = record;
  try {
    if (record) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(record));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // armazenamento indisponível
  }
  if (changed) listeners.forEach((cb) => cb(token, record));
}

async function loadProfile(user) {
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return decorate('users', { ...(data || { id: user.id, name: '', role: 'member' }), email: user.email || data?.email || '' });
}

// Sessão guardada: disponível de imediato (o papel vem do perfil em cache até ser confirmado).
const stored = readStoredSession();
const cachedProfile = readCachedProfile();
if (stored?.access_token && stored?.user && cachedProfile?.id === stored.user.id) {
  authStore.token = stored.access_token;
  authStore.record = cachedProfile;
}

// Enquanto o supabase-js arranca (lê o armazenamento, renova o token ou consome o
// `#access_token=…` que a Google devolve) ainda não se sabe se há sessão. As guardas das
// páginas protegidas esperam por este sinal em vez de assumirem que não há ninguém: era aí
// que o login com a Google acabava de volta no ecrã de entrada.
const authGate = createReadyGate();

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session?.user) {
    setAuth('', null);
    authGate.resolve();
    return;
  }
  // Fora do callback: o supabase-js não permite chamadas ao cliente dentro dele.
  setTimeout(async () => {
    const record = await loadProfile(session.user).catch(() => authStore.record);
    setAuth(session.access_token, record);
    authGate.resolve();
  }, 0);
});

function translateAuthError(error) {
  const msg = String(error?.message || '');
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) return new DataError('Email ou palavra-passe incorrectos.', 400);
  if (lower.includes('email not confirmed')) return new DataError('Confirme o seu email (enviámos um link) antes de entrar.', 400);
  if (lower.includes('already registered')) return new DataError('Já existe uma conta com este email.', 400);
  if (lower.includes('password should be')) return new DataError('A palavra-passe deve ter pelo menos 6 caracteres.', 400);
  if (lower.includes('rate limit')) return new DataError('Demasiados pedidos. Tente novamente dentro de alguns minutos.', 429);
  if (lower.includes('failed to fetch')) return new DataError('Servidor indisponível. Verifique a ligação à internet.', 0);
  return new DataError(msg || 'Não foi possível autenticar.', Number(error?.status) || 400);
}

// ---------------------------------------------------------------------------
// Colecções
// ---------------------------------------------------------------------------
function collection(name) {
  const table = TABLE_FOR[name] || name;

  const select = (fields) => {
    const cols = fields ? String(fields).split(',').map((s) => s.trim()).filter(Boolean).join(',') : '*';
    return cols || '*';
  };

  const api = {
    async getList(page = 1, perPage = 30, options = {}) {
      const from = (page - 1) * perPage;
      let query = supabase.from(table).select(select(options.fields), { count: 'exact' });
      query = applySort(applyFilter(query, options.filter), options.sort).range(from, from + perPage - 1);
      const { data, error, count } = await query;
      if (error) throw toDataError(error);
      const items = await attachExpand(name, (data || []).map((r) => decorate(name, r)), options.expand);
      const totalItems = count ?? items.length;
      return { page, perPage, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)), items };
    },

    async getFullList(batchOrOptions = {}, maybeOptions = {}) {
      const options = typeof batchOrOptions === 'number' ? maybeOptions : batchOrOptions;
      const pageSize = 1000;
      const all = [];
      for (let from = 0; ; from += pageSize) {
        let query = supabase.from(table).select(select(options.fields));
        query = applySort(applyFilter(query, options.filter), options.sort).range(from, from + pageSize - 1);
        const { data, error } = await query;
        if (error) throw toDataError(error);
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return attachExpand(name, all.map((r) => decorate(name, r)), options.expand);
    },

    async getOne(id, options = {}) {
      const { data, error } = await supabase.from(table).select(select(options.fields)).eq('id', id).maybeSingle();
      if (error) throw toDataError(error);
      if (!data) throw new DataError('Registo não encontrado.', 404);
      const [rec] = await attachExpand(name, [decorate(name, data)], options.expand);
      return rec;
    },

    async getFirstListItem(filter, options = {}) {
      const { items } = await api.getList(1, 1, { ...options, filter });
      if (!items.length) throw new DataError('Registo não encontrado.', 404);
      return items[0];
    },

    async create(data) {
      if (name === 'users') return createUser(data);
      const { body, files } = splitPayload(name, data);
      const { data: row, error } = await supabase.from(table).insert(body).select().single();
      if (error) throw toDataError(error);
      if (!Object.keys(files).length) return decorate(name, row);
      return api.update(row.id, files);
    },

    async update(id, data) {
      if (name === 'users') return updateUser(id, data);
      const { body, files } = splitPayload(name, data);
      if (Object.keys(files).length) {
        const { data: previous } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
        Object.assign(body, await applyFiles(name, id, files, previous));
      }
      const { data: row, error } = await supabase.from(table).update(body).eq('id', id).select().maybeSingle();
      if (error) throw toDataError(error);
      if (!row) throw new DataError('Registo não encontrado ou sem permissão.', 404);
      return decorate(name, row);
    },

    async delete(id) {
      if (name === 'users') {
        await appApi('/admin/users/delete', { id });
        return true;
      }
      const { data: previous } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw toDataError(error);
      for (const field of FILE_FIELDS[name] || []) await removeFile(name, id, previous?.[field]);
      return true;
    },

    // --- Equivalentes da colecção "users" do PocketBase ---
    async authWithPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw translateAuthError(error);
      const record = await loadProfile(data.user);
      setAuth(data.session.access_token, record);
      return { token: data.session.access_token, record };
    },

    async requestPasswordReset(email, redirectTo) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || `${window.location.origin}/reset-password`,
      });
      if (error) throw translateAuthError(error);
      return true;
    },

    // O link do email já abre uma sessão de recuperação; aqui só se define a nova palavra-passe.
    async confirmPasswordReset(_token, password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw translateAuthError(error);
      return true;
    },
  };
  return api;
}

async function createUser(data) {
  const { email, password, name } = data instanceof FormData ? formDataToObject(data) : data;
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name || '' }, emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw translateAuthError(error);
  if (!result.user) throw new DataError('Não foi possível criar a conta.');
  // Com a confirmação de email activa, o Supabase cria a conta mas não abre sessão.
  if (!result.session) return { needsConfirmation: true, email };
  const record = await loadProfile(result.user);
  setAuth(result.session.access_token, record);
  return record;
}

async function updateUser(id, data) {
  const { body, files } = splitPayload('users', data);
  const isSelf = authStore.record?.id === id;

  if (isSelf && (body.password || body.email)) {
    const attrs = {};
    if (body.password) attrs.password = body.password;
    if (body.email && body.email !== authStore.record?.email) attrs.email = body.email;
    if (Object.keys(attrs).length) {
      const { error } = await supabase.auth.updateUser(attrs);
      if (error) throw translateAuthError(error);
    }
  }

  const patch = {};
  for (const key of PROFILE_COLUMNS) if (key in body) patch[key] = body[key];
  if (Object.keys(files).length) {
    const { data: previous } = await supabase.from('profiles').select('avatar').eq('id', id).maybeSingle();
    Object.assign(patch, await applyFiles('users', id, files, previous));
  }

  let row;
  if (Object.keys(patch).length) {
    const { data: saved, error } = await supabase.from('profiles').update(patch).eq('id', id).select().maybeSingle();
    if (error) throw toDataError(error);
    if (!saved) throw new DataError('Sem permissão para alterar este utilizador.', 403);
    row = saved;
  } else {
    const { data: current } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    row = current;
  }
  // O email novo só passa a valer depois de confirmado no link que o Supabase envia;
  // até lá a conta (e as encomendas) continuam no email actual.
  const record = decorate('users', { ...row, email: isSelf ? (authStore.record?.email || row?.email) : row?.email });
  if (isSelf) setAuth(authStore.token, record);
  return record;
}

const files = {
  getURL(record, filename) {
    if (!record || !filename) return '';
    return mediaUrl(record.collectionName || record.collectionId || 'stock_books', record.id, filename);
  },
};
files.getUrl = files.getURL;

/** Equivalente a pb.send('/api/app/...') — chama a Edge Function "app". */
async function send(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${APP_API_URL}${String(path).replace(/^\/api\/app/, '')}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError(out.message || `Erro ${res.status}`, res.status, out);
  return out;
}

const pb = {
  collection,
  files,
  authStore,
  send,
  autoCancellation() {},
};

export default pb;
