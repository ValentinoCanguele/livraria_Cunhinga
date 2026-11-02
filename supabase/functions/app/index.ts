// API da Livraria (antes: pb_hooks/main.pb.js e chat.pb.js do PocketBase).
// URL: <SUPABASE_URL>/functions/v1/app/<rota>  — as rotas mantêm os caminhos de /api/app/*.
// Deploy com verify_jwt=false: a autenticação é feita aqui (token do Supabase Auth, quando existe).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import nodemailer from "npm:nodemailer@6.9.16";
import {
  brandFromSettings, categoryStates, emailDocument, formatKz, isCategoryEnabled,
  isRetriableFailure, retryDelaySeconds, secretsMatch, type Brand, type FailureSource,
} from "./emails.ts";
import {
  accessLinkLetter,
  noticeLetter,
  orderCreatedLetter,
  orderStatusLetter,
  paymentConfirmedLetter,
  testLetter,
  welcomeLetter,
  PREVIEW_TEMPLATES,
  unsubscribeUrlFor,
  type Letter,
} from "./emailTemplates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db: SupabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const MEDIA = `${SUPABASE_URL}/storage/v1/object/public/media`;
// Imagens entregues com o site (app/web/public/images/site), usadas quando o painel ainda
// não escolheu nenhuma. Ficam na galeria de imagens prontas do painel.
const DEFAULT_SHOP_BG = "/images/site/loja-banner.webp";
const DEFAULT_ABOUT_TOP = "/images/site/sobre-topo.webp";
const DEFAULT_ABOUT_SIDE = "/images/site/sobre-livros.webp";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const bad = (msg: string) => new HttpError(400, msg);

type Row = Record<string, any>;
type Auth = { id: string; email: string; role: string; permissions: Row } | null;
type Ctx = { req: Request; url: URL; body: Row; auth: Auth; ip: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
// Limite de pedidos partilhado por todas as instâncias (migração `limites_pedidos`).
// O limite em memória que existia aqui era por isolate: as Edge Functions escalam e
// reciclam, por isso perdia-se a cada arranque a frio e não travava ninguém.
const rateLimitStore: Record<string, number[]> = {};
let sharedRateLimitOff = false;

/** Recuo local, para o caso de a função na base de dados ainda não existir. */
function checkRateLimitLocal(bucket: string, ip: string, maxPerMinute: number) {
  const key = `${bucket}:${ip || "anon"}`;
  const now = Date.now();
  rateLimitStore[key] = (rateLimitStore[key] || []).filter((t) => now - t < 60000);
  if (rateLimitStore[key].length >= maxPerMinute) return false;
  rateLimitStore[key].push(now);
  return true;
}

async function checkRateLimit(bucket: string, ip: string, maxPerMinute = 30): Promise<boolean> {
  if (!sharedRateLimitOff) {
    const { data, error } = await db.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_client: ip || "anon",
      p_max: maxPerMinute,
    });
    if (!error) return data !== false;
    // Função em falta (migração por aplicar): usa o limite local e não volta a tentar.
    if (error.code === "PGRST202" || /could not find the function|does not exist/i.test(error.message || "")) {
      sharedRateLimitOff = true;
      console.log("check_rate_limit em falta na base de dados; a usar o limite em memória.");
    } else {
      // Falha passageira da base de dados não pode derrubar a loja.
      console.log("check_rate_limit:", error.message);
      return checkRateLimitLocal(bucket, ip, maxPerMinute);
    }
  }
  return checkRateLimitLocal(bucket, ip, maxPerMinute);
}

const nowISO = () => new Date().toISOString();
const fileUrl = (table: string, rec: Row, field: string) =>
  rec?.[field] ? `${MEDIA}/${table}/${rec.id}/${encodeURIComponent(rec[field])}` : "";
const normalizeEmail = (email: string) => (email || "").trim().toLowerCase();
// Igualdade sem distinguir maiúsculas (ilike sem curingas).
const likeExact = (value: string) => value.replace(/[\\%_]/g, (c) => "\\" + c);
const normalizePhone = (phone: string) => (phone || "").replace(/\D/g, "");
// Formatação determinista (ver `formatKz`): o `toLocaleString("pt-AO")` devolvia o
// separador de milhares que o ICU daquele runtime tivesse, e os valores dos recibos e das
// mensagens de WhatsApp mudavam de formato com a máquina.
const fmtMoneyKz = formatKz;

type NotifyMeta = { context?: string; customer_name?: string; order_number?: string; dedupe?: string; category?: string };

/** Regista o resultado real de cada envio em notification_logs (visível no admin → Integrações). */
async function logNotification(entry: Row) {
  // Emails de conta levam um link de acesso pessoal: não ficam guardados no registo, que toda a equipa lê.
  const content = entry.context === "account" ? "(conteúdo omitido: contém um link de acesso pessoal)" : entry.content;
  const { error } = await db.from("notification_logs").insert({
    ...entry,
    content: String(content || "").slice(0, 20000),
    detail: String(entry.detail || "").slice(0, 2000),
  });
  if (error) console.log("notification_logs:", error.message);
}

const timelineEvent = (status: string, title: string, description = "", location = "Luanda") =>
  ({ status, title, description, location: location || "Luanda", at: nowISO() });

async function getAuth(req: Request): Promise<Auth> {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.startsWith("sb_")) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await db.from("profiles").select("role, permissions").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email || "", role: profile?.role || "member", permissions: profile?.permissions || {} };
}

const isStaff = (auth: Auth) => !!auth && (auth.role === "admin" || auth.role === "manager");

// Igual a private.has_permission() na base de dados: admin pode tudo; gestor só o que tiver activo.
const PERMISSION_KEYS = ["manage_catalog", "manage_orders", "manage_settings", "manage_users", "manage_payments", "manage_marketing"];
const can = (auth: Auth, key: string) =>
  !!auth && (auth.role === "admin" || (auth.role === "manager" && auth.permissions?.[key] === true));
function requirePermission(auth: Auth, key: string) {
  if (!can(auth, key)) throw new HttpError(403, "Sem permissão para esta operação.");
  return auth!;
}
/** CRM (contactos e campanhas): como nas políticas RLS, "Utilizadores e Clientes" ou "Marketing". */
function requireCrm(auth: Auth) {
  if (!can(auth, "manage_users") && !can(auth, "manage_marketing")) throw new HttpError(403, "Sem permissão para esta operação.");
  return auth!;
}

// O registo de configuração activo é o mais antigo (o mesmo que o PocketBase usava).
async function getSettings(): Promise<Row | null> {
  const { data } = await db.from("site_settings").select("*")
    .order("created", { ascending: true }).order("id", { ascending: false }).limit(1);
  return data?.[0] || null;
}

// Regras da loja configuráveis pelo admin (Configurações → Regras da loja), sempre dentro de limites seguros.
const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};
function storeRules(settings: Row | null) {
  const prefix = String(settings?.order_number_prefix ?? "ENC-").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);
  return {
    orderPrefix: prefix,
    notesMax: clampInt(settings?.checkout_notes_max, 0, 5000, 2000),
    checkoutRate: clampInt(settings?.checkout_rate_per_minute, 1, 60, 15),
    trackRate: clampInt(settings?.track_rate_per_minute, 1, 120, 20),
    receiptPerOrder: clampInt(settings?.receipt_per_order_per_minute, 1, 10, 3),
  };
}

async function getIntegration(code: string): Promise<Row | null> {
  const { data } = await db.from("app_integrations").select("*").eq("code", code).limit(1);
  return data?.[0] || null;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
/** Já saiu um email para este acontecimento? Impede duplicados em repetições e reinícios. */
async function alreadySent(dedupe: string) {
  if (!dedupe) return false;
  const { data, error } = await db.from("notification_logs")
    .select("id").eq("dedupe_key", dedupe).eq("status", "sent").limit(1);
  // Numa falha de leitura segue-se o envio: perder uma confirmação é pior do que repetir uma.
  if (error) {
    console.log("alreadySent:", error.message);
    return false;
  }
  return !!data?.length;
}

/**
 * Envia uma mensagem transaccional e registo do resultado real em `notification_logs`.
 *
 * Leva sempre as duas versões, HTML e texto simples: clientes que não mostram HTML, e os
 * filtros de correio, contam com a segunda, e um email só com HTML tem mais probabilidade de
 * acabar no lixo.
 */
type SendOutcome = { ok: boolean; source?: FailureSource; status?: number; detail: string; provider: string };

/** Entrega uma mensagem ao fornecedor. Só envia: não regista nem decide repetições. */
async function deliverEmail(settings: Row, to: string, subject: string, html: string, text: string, headers: Record<string, string>): Promise<SendOutcome> {
  const siteName = settings.site_name || "Livraria Adventista";
  const provider = settings.email_provider || "smtp";
  const fromEmail = settings.smtp_from_email || settings.contact_email || "noreply@livraria.ao";
  const fromName = settings.smtp_from_name || siteName;

  if (provider === "sendgrid") {
    if (!settings.sendgrid_api_key) {
      return { ok: false, detail: "Chave SendGrid em falta.", provider };
    }
    // A ordem importa: o SendGrid usa a última parte como a preferida, por isso o HTML vem
    // depois do texto simples.
    const content = [
      ...(text ? [{ type: "text/plain", value: text }] : []),
      { type: "text/html", value: html },
    ];
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.sendgrid_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content,
          ...(Object.keys(headers).length ? { headers } : {}),
        }),
      });
      if (res.ok) return { ok: true, detail: `SendGrid ${res.status}`, provider };
      return { ok: false, source: "http", status: res.status, detail: `SendGrid ${res.status}: ${await res.text()}`, provider };
    } catch (err) {
      return { ok: false, source: "network", detail: (err as Error)?.message || String(err), provider };
    }
  }

  if (!settings.smtp_host) {
    return { ok: false, detail: "Servidor SMTP não configurado.", provider: "smtp" };
  }
  const port = Number(settings.smtp_port) || 465;
  try {
    const transport = nodemailer.createTransport({
      host: settings.smtp_host,
      port,
      secure: port === 465,
      auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_password || "" } : undefined,
    });
    const info = await transport.sendMail({
      from: { name: fromName, address: fromEmail },
      to, subject, html, ...(text ? { text } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    });
    return { ok: true, detail: `${settings.smtp_host}:${port} · ${info?.response || "aceite"}`, provider: "smtp" };
  } catch (err) {
    const e = err as { responseCode?: number; message?: string; code?: string };
    // Sem resposta do servidor é falha de ligação; com código SMTP, é o servidor a recusar.
    const source: FailureSource = e?.responseCode ? "smtp" : "network";
    return { ok: false, source, status: e?.responseCode, detail: e?.message || String(err), provider: "smtp" };
  }
}

/**
 * Envia uma mensagem transaccional, regista o resultado e guarda para repetir o que falhou
 * por motivo passageiro.
 *
 * Leva sempre as duas versões, HTML e texto simples: clientes que não mostram HTML, e os
 * filtros de correio, contam com a segunda, e um email só com HTML tem mais probabilidade de
 * acabar no lixo.
 */
async function sendTransactionalEmail(
  settings: Row | null,
  to: string,
  subject: string,
  html: string,
  meta: NotifyMeta = {},
  text = "",
  headers: Record<string, string> = {},
) {
  if (!to) return false;
  const dedupe = meta.dedupe || "";
  if (dedupe && await alreadySent(dedupe)) {
    console.log("Email repetido ignorado:", dedupe);
    return true;
  }
  const base = {
    type: "email", context: meta.context || "order", recipient: to,
    customer_name: meta.customer_name || "", order_number: meta.order_number || "",
    subject, content: html, ...(dedupe ? { dedupe_key: dedupe } : {}),
  };
  if (!settings) {
    await logNotification({ ...base, status: "skipped", detail: "Configurações do site em falta." });
    return false;
  }

  const outcome = await deliverEmail(settings, to, subject, html, text, headers);
  if (outcome.ok) {
    await logNotification({ ...base, status: "sent", provider: outcome.provider, detail: outcome.detail });
    return true;
  }

  // Configuração em falta não é falha de envio: não há nada para repetir até alguém a tratar.
  if (!outcome.source) {
    await logNotification({ ...base, status: "skipped", provider: outcome.provider, detail: outcome.detail });
    return false;
  }

  console.log("Transactional email error:", outcome.detail);
  const retriable = isRetriableFailure(outcome.source, outcome.status, outcome.detail);
  if (retriable) {
    const queued = await enqueueEmail({ to, subject, html, text, headers, meta, lastError: outcome.detail });
    await logNotification({
      ...base, status: "failed", provider: outcome.provider,
      detail: queued ? `${outcome.detail} · na fila para repetir` : outcome.detail,
    });
  } else {
    await logNotification({ ...base, status: "failed", provider: outcome.provider, detail: outcome.detail });
  }
  return false;
}

/** Guarda uma mensagem para repetir mais tarde. */
async function enqueueEmail(job: {
  to: string; subject: string; html: string; text: string;
  headers: Record<string, string>; meta: NotifyMeta; lastError: string;
}) {
  const { error } = await db.from("email_queue").insert({
    recipient: job.to,
    subject: job.subject,
    html: job.html,
    text_body: job.text,
    headers: Object.keys(job.headers).length ? job.headers : null,
    context: job.meta.context || "order",
    customer_name: job.meta.customer_name || "",
    order_number: job.meta.order_number || "",
    dedupe_key: job.meta.dedupe || null,
    attempts: 1,
    next_attempt_at: new Date(Date.now() + retryDelaySeconds(1) * 1000).toISOString(),
    last_error: job.lastError.slice(0, 2000),
  });
  // 23505: já lá está uma igual à espera. Repetir o pedido não põe duas na fila.
  if (error && error.code !== "23505") {
    console.log("email_queue insert:", error.message);
    return false;
  }
  return true;
}

/**
 * Processa um lote da fila: tenta entregar, e decide o que fazer com o que falhar.
 *
 * As mensagens são reclamadas por `claim_email_jobs`, que usa `for update skip locked`:
 * duas instâncias da Edge Function a correr ao mesmo tempo levam lotes diferentes, em vez de
 * enviarem a mesma mensagem duas vezes ao mesmo cliente.
 */
async function processEmailQueue(limit = 10) {
  const settings = await getSettings();
  const summary = { claimed: 0, sent: 0, retrying: 0, failed: 0 };
  if (!settings) return summary;

  const { data: jobs, error } = await db.rpc("claim_email_jobs", { p_limit: limit });
  if (error) {
    console.log("claim_email_jobs:", error.message);
    return summary;
  }
  summary.claimed = jobs?.length || 0;

  for (const job of jobs || []) {
    // Já saiu entretanto por outro caminho (um reenvio à mão, por exemplo).
    if (job.dedupe_key && await alreadySent(job.dedupe_key)) {
      await db.from("email_queue").update({ status: "sent", last_error: "Já tinha sido enviada." }).eq("id", job.id);
      summary.sent++;
      continue;
    }

    const headers = (job.headers && typeof job.headers === "object") ? job.headers as Record<string, string> : {};
    const outcome = await deliverEmail(settings, job.recipient, job.subject, job.html, job.text_body || "", headers);
    const attempts = (Number(job.attempts) || 0) + 1;
    const base = {
      type: "email", context: job.context || "order", recipient: job.recipient,
      customer_name: job.customer_name || "", order_number: job.order_number || "",
      subject: job.subject, content: job.html,
      ...(job.dedupe_key ? { dedupe_key: job.dedupe_key } : {}),
    };

    if (outcome.ok) {
      await db.from("email_queue").update({ status: "sent", attempts, last_error: "" }).eq("id", job.id);
      await logNotification({ ...base, status: "sent", provider: outcome.provider, detail: `${outcome.detail} · tentativa ${attempts}` });
      summary.sent++;
      continue;
    }

    const maxAttempts = Number(job.max_attempts) || 5;
    const retriable = !!outcome.source && isRetriableFailure(outcome.source, outcome.status, outcome.detail);
    // Desistir quando a causa não melhora com o tempo, ou quando as tentativas acabaram:
    // insistir num endereço que não existe prejudica a reputação do domínio.
    if (!retriable || attempts >= maxAttempts) {
      await db.from("email_queue").update({
        status: "failed", attempts, last_error: outcome.detail.slice(0, 2000),
      }).eq("id", job.id);
      await logNotification({
        ...base, status: "failed", provider: outcome.provider,
        detail: `${outcome.detail} · ${retriable ? `desistiu ao fim de ${attempts} tentativas` : "falha definitiva"}`,
      });
      summary.failed++;
      continue;
    }

    await db.from("email_queue").update({
      status: "pending", attempts,
      next_attempt_at: new Date(Date.now() + retryDelaySeconds(attempts) * 1000).toISOString(),
      last_error: outcome.detail.slice(0, 2000),
      locked_at: null,
    }).eq("id", job.id);
    summary.retrying++;
  }
  return summary;
}

/** Identidade visual da loja para os emails, com o endereço público configurado no painel. */
function emailBrand(settings: Row | null): Brand {
  return brandFromSettings(settings, String(settings?.site_url || Deno.env.get("SITE_URL") || ""));
}

/**
 * Envia um modelo pronto (`emailTemplates.ts`), com HTML e texto simples.
 *
 * Verifica aqui a categoria, e não em cada sítio que chama: uma categoria esquecida num dos
 * pontos de envio seria uma mensagem a sair depois de a loja a ter desligado. As
 * transaccionais não são desligáveis, e `isCategoryEnabled` trata disso.
 */
async function sendLetter(settings: Row | null, to: string, letter: Letter, meta: NotifyMeta = {}) {
  const category = meta.category || "";
  if (category && !isCategoryEnabled(settings, category)) {
    await logNotification({
      type: "email", context: meta.context || "order", recipient: to,
      customer_name: meta.customer_name || "", order_number: meta.order_number || "",
      subject: letter.subject, content: "", status: "skipped",
      detail: `Categoria "${category}" desligada em Configurações.`,
    });
    return false;
  }
  const { html, text } = emailDocument(emailBrand(settings), letter.doc);
  // `List-Unsubscribe` é o que os clientes de email usam para mostrar o botão próprio de
  // cancelamento, e o Gmail exige-o a quem envia em volume. O `One-Click` diz que basta um
  // pedido ao endereço, sem o utilizador ter de confirmar noutra página.
  const unsubscribe = letter.doc.unsubscribeUrl || "";
  const headers = unsubscribe
    ? { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : {};
  return sendTransactionalEmail(settings, to, letter.subject, html, meta, text, headers);
}

/** Link de pagamento do método da encomenda (ex.: Multicaixa Express), se o pagamento ainda não estiver confirmado. */
async function orderPaymentLink(order: Row) {
  if (!order?.payment_method_code || order.payment_status === "paid") return "";
  const { data } = await db.from("payment_methods").select("payment_link").eq("code", order.payment_method_code).eq("enabled", true).limit(1);
  const link = String(data?.[0]?.payment_link || "");
  return /^https:\/\//.test(link) ? link : "";
}

async function sendOrderConfirmationEmail(order: Row, settings: Row | null) {
  if (!settings?.order_email_enabled || !order.customer_email) return false;
  const paymentLink = await orderPaymentLink(order);
  const letter = orderCreatedLetter(emailBrand(settings), order, paymentLink);
  return sendLetter(settings, order.customer_email, letter, {
    context: "order",
    customer_name: order.customer_name,
    order_number: order.order_number,
    // Uma só confirmação por encomenda, mesmo que o checkout seja repetido.
    dedupe: `order:created:${order.id}`,
  });
}

/**
 * Avisa o cliente de uma mudança de estado da encomenda.
 *
 * Só envia quando o estado muda de facto e quando há texto para esse estado: um email por
 * cada gravação no painel, ou por um estado que nada diz ao cliente, seria ruído. A chave de
 * idempotência é a encomenda mais o estado, por isso voltar a pôr a encomenda no mesmo
 * estado não repete a mensagem.
 */
const PROGRESS_STATUSES = ["confirmed", "preparing", "shipped", "in_transit", "out_for_delivery"];

async function sendOrderStatusEmail(order: Row, settings: Row | null, status: string, event?: Row) {
  if (!settings?.order_email_enabled || !order.customer_email) return false;
  const letter = orderStatusLetter(emailBrand(settings), order, status, event);
  if (!letter) return false;
  return sendLetter(settings, order.customer_email, letter, {
    context: "order_status",
    // "Entregue" e "Cancelada" não entram na categoria opcional: são o fecho da compra e
    // saem mesmo com o acompanhamento desligado.
    category: PROGRESS_STATUSES.includes(status) ? "order_progress" : "",
    customer_name: order.customer_name,
    order_number: order.order_number,
    dedupe: `order:status:${order.id}:${status}`,
  });
}

/** Avisa o cliente de que o pagamento ficou confirmado. */
async function sendPaymentConfirmedEmail(order: Row, settings: Row | null) {
  if (!settings?.order_email_enabled || !order.customer_email) return false;
  const letter = paymentConfirmedLetter(emailBrand(settings), order);
  return sendLetter(settings, order.customer_email, letter, {
    context: "payment",
    customer_name: order.customer_name,
    order_number: order.order_number,
    dedupe: `order:paid:${order.id}`,
  });
}

// ---------------------------------------------------------------------------
// WhatsApp Business (Meta Cloud API)
// ---------------------------------------------------------------------------
async function getWhatsAppConfig(): Promise<Row | null> {
  const rec = await getIntegration("whatsapp_business");
  if (!rec?.enabled) return null;
  const cfg = rec.config || {};
  if (!cfg.access_token || !cfg.phone_number_id) return null;
  return cfg;
}

const waNumber = (phone: string) => {
  const digits = normalizePhone(phone);
  return digits.startsWith("244") ? digits : "244" + digits.replace(/^0/, "");
};

async function metaSend(config: Row, payload: Row) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true };
  const raw = await res.text();
  console.log(`WhatsApp API error ${res.status}: ${raw}`);
  return { ok: false, status: res.status, error: raw || "WhatsApp API error" };
}

function sendWhatsAppText(phone: string, text: string, config: Row) {
  return metaSend(config, {
    messaging_product: "whatsapp", recipient_type: "individual", to: waNumber(phone),
    type: "text", text: { preview_url: true, body: text },
  });
}

function sendWhatsAppTemplate(phone: string, config: Row, bodyParams: unknown[]) {
  const template: Row = { name: config.template_name || "order_confirmation", language: { code: config.template_language || "pt_PT" } };
  if (bodyParams?.length) {
    template.components = [{ type: "body", parameters: bodyParams.map((p) => ({ type: "text", text: String(p) })) }];
  }
  return metaSend(config, { messaging_product: "whatsapp", to: waNumber(phone), type: "template", template });
}

async function sendWhatsAppMessage(phone: string, text: string, config: Row | null, templateParams?: Row, meta: NotifyMeta = {}) {
  const base = { type: "whatsapp", context: meta.context || "order", recipient: phone, customer_name: meta.customer_name || "", order_number: meta.order_number || "", content: text, provider: "meta" };
  if (!phone || !config) {
    if (phone) await logNotification({ ...base, status: "skipped", detail: "WhatsApp Business API não configurada." });
    return { ok: false, error: "missing_config" } as Row;
  }
  const result = await sendWhatsAppMessageRaw(phone, text, config, templateParams);
  await logNotification({
    ...base,
    status: result.ok ? "sent" : "failed",
    subject: config.use_template && config.template_name ? `Modelo: ${config.template_name}` : "Mensagem de texto",
    detail: result.ok ? "Aceite pela Meta Cloud API" : `${result.status || ""} ${result.error || ""}`.trim(),
  });
  return result;
}

async function sendWhatsAppMessageRaw(phone: string, text: string, config: Row, templateParams?: Row) {
  if (config.use_template && config.template_name) {
    const params = templateParams?.bodyParams || [
      templateParams?.customerName || "Cliente", templateParams?.orderNumber || "", templateParams?.total || "",
    ];
    const tpl = await sendWhatsAppTemplate(phone, config, params);
    if (tpl.ok) return tpl;
  }
  return sendWhatsAppText(phone, text, config);
}

const buildWhatsAppNotifyUrl = (phone: string, message: string) =>
  `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(message || "")}`;

async function sendContactWhatsApp(phone: string, body: string, meta: NotifyMeta = {}) {
  const config = await getWhatsAppConfig();
  if (config) {
    const result = await sendWhatsAppMessage(phone, body, config, undefined, meta);
    return { apiSent: !!result.ok, waUrl: "" };
  }
  return { apiSent: false, waUrl: buildWhatsAppNotifyUrl(phone, body) };
}

async function sendOrderWhatsAppConfirmation(order: Row, settings: Row | null) {
  const config = await getWhatsAppConfig();
  if (!config || !order.phone) return false;
  const siteName = settings?.site_name || "Livraria Adventista";
  const lines = [
    `✅ *Encomenda Confirmada — ${siteName}*`, `Nº: ${order.order_number || ""}`, "",
    `Olá ${order.customer_name || ""}!`, "", "*Livros:*",
    ...(order.items || []).map((it: Row) => `• ${it.quantity || 1}× ${it.title || "Livro"}`),
    "", `*Total: ${fmtMoneyKz(order.total)}*`, "", "Obrigado pela sua compra! 📚",
  ];
  const result = await sendWhatsAppMessage(order.phone, lines.join("\n"), config, {
    bodyParams: [order.customer_name || "Cliente", order.order_number || "", fmtMoneyKz(order.total)],
  }, { context: "order", customer_name: order.customer_name, order_number: order.order_number });
  if (!result.ok) return false;
  const storePhone = settings?.whatsapp || settings?.contact_phone || "";
  if (storePhone && order.sale_channel === "whatsapp") {
    const storeMsg = `🛒 *Nova encomenda WhatsApp*\nNº: ${order.order_number || ""}\nCliente: ${order.customer_name || ""}\nTel: ${order.phone}\nTotal: ${fmtMoneyKz(order.total)}`;
    await sendWhatsAppText(storePhone, storeMsg, config).catch(() => {});
  }
  return true;
}

function sanitizeIntegrationConfig(code: string, config: Row) {
  if (!config || typeof config !== "object") return {};
  if (code === "google_drive") {
    return { folder_id: config.folder_id || "", has_api_key: !!config.api_key, has_client_id: !!config.client_id };
  }
  if (code === "whatsapp_business") {
    return {
      configured: !!(config.access_token && config.phone_number_id),
      has_token: !!config.access_token,
      has_phone_id: !!config.phone_number_id,
      use_template: !!config.use_template,
      template_name: config.template_name || "order_confirmation",
      template_language: config.template_language || "pt_PT",
      auto_send: config.auto_send !== false,
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------
async function findContact(externalId?: string, email?: string, phone?: string): Promise<Row | null> {
  if (externalId) {
    const { data } = await db.from("contacts").select("*").eq("external_id", externalId).limit(1);
    if (data?.[0]) return data[0];
  }
  const em = normalizeEmail(email || "");
  if (em) {
    const { data } = await db.from("contacts").select("*").ilike("email", likeExact(em)).limit(1);
    if (data?.[0]) return data[0];
  }
  const ph = normalizePhone(phone || "");
  if (ph.length >= 9) {
    const { data } = await db.from("contacts").select("*").neq("phone", "").limit(500);
    const hit = (data || []).find((c) => normalizePhone(c.phone) === ph);
    if (hit) return hit;
  }
  return null;
}

function mergeTags(existing: unknown, incoming: unknown) {
  const out: string[] = [];
  for (const t of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

async function upsertContact(item: Row, ownerId: string | null) {
  const existing = await findContact(item.external_id, item.email, item.phone);
  const rec: Row = {};
  if (!existing) {
    rec.name = item.name || "Sem Nome";
    rec.source = item.source || "manual";
    if (ownerId) rec.owner = ownerId;
  }
  if (item.name) rec.name = item.name;
  if (item.email) rec.email = normalizeEmail(item.email);
  if (item.phone) rec.phone = item.phone;
  if (item.photo_url) rec.photo_url = item.photo_url;
  if (item.external_id) rec.external_id = item.external_id;
  if (item.tags?.length) rec.tags = mergeTags(existing?.tags, item.tags);
  if (item.notes) rec.notes = item.notes;
  if (item.is_buyer != null) rec.is_buyer = !!item.is_buyer || !!existing?.is_buyer;
  if (item.metadata) rec.metadata = item.metadata;
  rec.last_synced_at = nowISO();
  rec.sync_status = "synced";
  if (existing) {
    const { error } = await db.from("contacts").update(rec).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, created: false };
  }
  const { data, error } = await db.from("contacts").insert(rec).select("id").single();
  if (error) throw error;
  return { id: data.id, created: true };
}

async function getDefaultOwnerId() {
  const { data } = await db.from("profiles").select("id").eq("role", "admin").order("created").limit(1);
  return data?.[0]?.id || null;
}

async function countRows(table: string, filter?: (q: any) => any) {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count || 0;
}

// Preço em vigor (igual a public.effective_price na base de dados): promocional se estiver activo.
function effectivePrice(b: Row) {
  const price = Number(b?.price) || 0;
  const sale = Number(b?.sale_price) || 0;
  const now = Date.now();
  const started = !b?.sale_starts_at || new Date(b.sale_starts_at).getTime() <= now;
  const notEnded = !b?.sale_ends_at || new Date(b.sale_ends_at).getTime() > now;
  return sale > 0 && sale < price && started && notEnded ? sale : price;
}

async function getNewBooksDigest() {
  const { data: books } = await db.from("stock_books").select("title, price, sale_price, sale_starts_at, sale_ends_at").eq("active", true).gt("stock", 0)
    .order("created", { ascending: false }).limit(5);
  if (!books?.length) return "";
  const lines = ["📚 *Novidades na Livraria Adventista*", ""];
  for (const b of books) {
    const price = b.price ? `${effectivePrice(b).toLocaleString("pt-AO")} Kz` : "";
    lines.push(`• ${b.title || "Livro"}${price ? " — " + price : ""}`);
  }
  lines.push("", "Visite: https://livrariaadventista.ao/shop");
  return lines.join("\n");
}

function calcNextSendAt(frequency: string) {
  const d = new Date();
  if (frequency === "daily") d.setDate(d.getDate() + 1);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// Contactos com esta etiqueta não recebem envios manuais nem campanhas.
const OPT_OUT_TAG = "nao-contactar";
/**
 * Não contactar este contacto?
 *
 * Duas origens para a mesma decisão: a etiqueta, que a equipa põe no painel, e a data, que
 * fica quando o próprio cliente usa o link de cancelamento no rodapé de uma campanha. A
 * etiqueta é o que o painel mostra e o que já era verificado; a data diz quando foi e que
 * partiu do cliente. Qualquer uma delas basta — uma gravação que falhe a meio não pode
 * resultar em mensagens a continuar a sair.
 */
const isOptedOut = (contact: Row) =>
  (Array.isArray(contact.tags) && contact.tags.includes(OPT_OUT_TAG)) || !!contact.marketing_opt_out_at;
const MAX_NOTIFY_CONTACTS = 300;
const clipText = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

async function notifyContact(contact: Row, opts: Row) {
  const { channel, subject, body, settings } = opts;
  const notif: Row = {
    owner: opts.owner, contact: contact.id, group: opts.groupId || null, campaign: opts.campaignId || null,
    channel, subject, body, status: "pending", sent_at: nowISO(),
  };
  let waUrl = "";
  let whatsappApiSent = false;
  let emailSent = false;
  let status = "failed";
  const hasPhone = !!(contact.phone || "").trim();
  const hasEmail = !!(contact.email || "").trim();

  if (channel === "whatsapp" || channel === "both") {
    if (hasPhone) {
      const wa = await sendContactWhatsApp(contact.phone, body, { context: opts.campaignId ? "campaign" : "contact", customer_name: contact.name });
      waUrl = wa.waUrl;
      whatsappApiSent = wa.apiSent;
      if (waUrl) notif.whatsapp_url = waUrl;
      // Sem a API, só existe um link para envio manual: não conta como enviado.
      if (wa.apiSent) status = "sent";
      else if (waUrl) status = "manual";
    }
  }
  if (channel === "email" || channel === "both") {
    if (hasEmail && settings) {
      // Campanhas e avisos levam a mesma moldura das restantes mensagens, e no rodapé a
      // razão certa: as de marketing dizem como deixar de as receber.
      const isCampaign = !!opts.campaignId;
      const brand = emailBrand(settings);
      // Quem pediu para não ser contactado não recebe campanhas. A verificação é aqui, no
      // envio, e não só em quem escolhe os destinatários: uma lista montada antes do
      // cancelamento voltaria a apanhá-lo.
      if (isCampaign && isOptedOut(contact)) {
        await logNotification({
          type: "email", context: "campaign", recipient: contact.email,
          customer_name: contact.name || "", subject, content: "", status: "skipped",
          detail: "O contacto pediu para não ser contactado.",
        });
        emailSent = false;
      } else {
        emailSent = await sendLetter(
          settings, contact.email,
          noticeLetter(brand, subject, body, isCampaign, isCampaign ? unsubscribeUrlFor(brand, contact.unsubscribe_token || "") : ""),
          { context: isCampaign ? "campaign" : "contact", category: isCampaign ? "campaign" : "", customer_name: contact.name },
        );
      }
      if (channel === "email") status = emailSent ? "sent" : "failed";
      else if (emailSent) status = "sent";
    } else if (channel === "email") {
      status = "failed";
    }
  }
  notif.status = status;
  await db.from("contact_notifications").insert(notif);
  await db.from("contacts").update({ last_contacted_at: nowISO() }).eq("id", contact.id);
  return { waUrl, whatsappApiSent, emailSent, status };
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
type Handler = (ctx: Ctx) => Promise<Response>;
const routes: Record<string, Handler> = {};
const route = (method: string, path: string, handler: Handler) => { routes[`${method} ${path}`] = handler; };

route("GET", "/health", async () => json({ message: "API is healthy.", code: 200 }));

route("GET", "/settings", async () => {
  const rec = await getSettings();
  if (!rec) {
    return json({
      site_name: "Livraria Adventista", tagline: "Literatura que edifica e transforma", primary_color: "#0ea5c9",
      logo_url: "", favicon_url: "", contact_email: "contacto@livrariaadventista.ao", contact_phone: "+244 923 000 000",
      contact_address: "Luanda, Angola", pwa_enabled: true, pwa_theme_color: "#0c4a6e", shipping_free_threshold: 20000,
      shipping_cost: 1500, maintenance_mode: false, google_oauth_enabled: false,
      header_welcome_logged: "Bem-vindo de volta, {nome}",
      header_welcome_guest: "Envio em todo o país · Crie a sua conta para acompanhar encomendas",
      header_cta_text: "Explorar novidades", header_cta_link: "/shop", footer_tagline: "", footer_copyright: "",
      footer_columns: null, show_stores_in_footer: true, ui_glass_enabled: true, ui_glass_opacity: 0.72,
      shop_bg_mode: "image", shop_bg_image_url: DEFAULT_SHOP_BG, shop_bg_video_url: "", shop_bg_overlay: 0.55,
      about_top_image_url: DEFAULT_ABOUT_TOP, about_side_image_url: DEFAULT_ABOUT_SIDE, about_team: [],
    });
  }
  const brandImage = (urlField: string, fileField: string) => {
    const file = fileUrl("site_settings", rec, fileField);
    if (file) return file;
    const url = rec[urlField] || "";
    return url && !url.startsWith("blob:") ? url : "";
  };
  // O banner que vai no site (galeria: "Banner da loja · leque") é a predefinição quando
  // ainda não foi escolhido nenhum: o ficheiro era publicado mas nunca aparecia, porque sem
  // valor em `shop_bg_mode` o modo caía em "gradient". Continua a poder ser mudado em
  // Configurações → Fundo da loja, e quem escolher "gradient" fica com o gradiente.
  const shopBgImage = rec.shop_bg_image_url || DEFAULT_SHOP_BG;
  let bgMode = rec.shop_bg_mode || "image";
  if (bgMode === "image" && !shopBgImage) bgMode = "gradient";
  if (bgMode === "video" && !rec.shop_bg_video_url) bgMode = "gradient";
  if (!["gradient", "image", "video", "slides"].includes(bgMode)) bgMode = "gradient";
  const orTrue = (v: unknown) => (v == null ? true : !!v);
  return json({
    site_name: rec.site_name || "Livraria Adventista",
    tagline: rec.tagline || "",
    primary_color: rec.primary_color || "#0ea5c9",
    logo_url: brandImage("logo_url", "logo"),
    favicon_url: brandImage("favicon_url", "favicon"),
    assets_version: rec.updated || rec.created || "",
    login_bg_url: rec.login_bg_url || "",
    contact_email: rec.contact_email || "",
    contact_phone: rec.contact_phone || "",
    contact_address: rec.contact_address || "",
    whatsapp: rec.whatsapp || "",
    facebook: rec.facebook || "",
    instagram: rec.instagram || "",
    pwa_enabled: !!rec.pwa_enabled,
    pwa_name: rec.pwa_name || rec.site_name,
    pwa_short_name: rec.pwa_short_name || "LA",
    pwa_theme_color: rec.pwa_theme_color || "#0c4a6e",
    shipping_free_threshold: Number(rec.shipping_free_threshold) || 20000,
    shipping_cost: Number(rec.shipping_cost) || 1500,
    shipping_express_cost: Number(rec.shipping_express_cost) || 0,
    maintenance_mode: !!rec.maintenance_mode,
    order_number_prefix: storeRules(rec).orderPrefix,
    google_oauth_enabled: !!rec.google_oauth_enabled,
    header_welcome_logged: rec.header_welcome_logged || "Bem-vindo de volta, {nome}",
    header_welcome_guest: rec.header_welcome_guest || "Envio em todo o país · Crie a sua conta para acompanhar encomendas",
    header_cta_text: rec.header_cta_text || "Explorar novidades",
    header_cta_link: rec.header_cta_link || "/shop",
    footer_tagline: rec.footer_tagline || "",
    footer_copyright: rec.footer_copyright || "",
    footer_columns: rec.footer_columns || null,
    show_stores_in_footer: orTrue(rec.show_stores_in_footer),
    shop_hero_title: rec.shop_hero_title || "Todos os Livros",
    shop_hero_subtitle: rec.shop_hero_subtitle || "",
    shop_hero_badge: rec.shop_hero_badge || "Catálogo Premium",
    shop_default_sort: rec.shop_default_sort || "featured",
    shop_per_page: Number(rec.shop_per_page) || 24,
    shop_show_featured: orTrue(rec.shop_show_featured),
    shop_show_collections: orTrue(rec.shop_show_collections),
    shop_show_low_stock: orTrue(rec.shop_show_low_stock),
    shop_grid_columns: Number(rec.shop_grid_columns) || 4,
    ui_glass_enabled: orTrue(rec.ui_glass_enabled),
    ui_glass_opacity: Number(rec.ui_glass_opacity) || 0.72,
    shop_bg_mode: bgMode,
    shop_bg_image_url: shopBgImage,
    shop_bg_video_url: rec.shop_bg_video_url || "",
    shop_bg_overlay: Number(rec.shop_bg_overlay) || 0.55,
    // Vazio (ou coluna ainda sem a migração `imagens_sobre`) = a imagem que vem com o site.
    about_top_image_url: rec.about_top_image_url || DEFAULT_ABOUT_TOP,
    about_side_image_url: rec.about_side_image_url || DEFAULT_ABOUT_SIDE,
    // Equipa da página Sobre. Só sai o que é mostrado, e com tamanho limitado: a coluna é
    // escrita pelo painel, mas esta rota é pública e não deve devolver lixo nem campos extra.
    about_team: Array.isArray(rec.about_team)
      ? rec.about_team.slice(0, 40).map((m: Row) => ({
          name: String(m?.name ?? "").slice(0, 120),
          role: String(m?.role ?? "").slice(0, 120),
          photo_url: /^(https?:\/\/|\/)/.test(String(m?.photo_url ?? "")) ? String(m.photo_url).slice(0, 600) : "",
        })).filter((m: Row) => m.name)
      : [],
    google_maps_embed_key: rec.google_maps_embed_key || "",
    order_email_enabled: !!rec.order_email_enabled,
    push_enabled: !!rec.push_enabled,
    vapid_public_key: rec.vapid_public_key || "",
    chat_enabled: orTrue(rec.chat_enabled),
  });
});

route("GET", "/integrations", async () => {
  const { data: records } = await db.from("app_integrations").select("*");
  const out: Row = {};
  for (const r of records || []) {
    if (!r.code) continue;
    out[r.code] = {
      enabled: !!r.enabled,
      name: r.name || r.code,
      config: sanitizeIntegrationConfig(r.code, r.config && typeof r.config === "object" ? r.config : {}),
    };
  }
  const settings = await getSettings();
  if (settings) {
    if (!out.google_oauth) out.google_oauth = { enabled: false, config: {} };
    out.google_oauth.enabled = !!settings.google_oauth_enabled;
  }
  return json({ integrations: out });
});

route("GET", "/admin/media-config", async ({ auth }) => {
  if (!isStaff(auth)) throw new HttpError(403, "Acesso negado.");
  const drive = await getIntegration("google_drive");
  if (!drive?.enabled) return json({ google_drive: { enabled: false, config: {} } });
  const config = drive.config || {};
  return json({
    google_drive: {
      enabled: true,
      config: {
        api_key: config.api_key ? "••••••••" + String(config.api_key).slice(-4) : "",
        has_api_key: !!config.api_key,
        client_id: config.client_id || "",
        folder_id: config.folder_id || "",
      },
    },
  });
});

route("GET", "/admin/drive-images", async ({ auth, url }) => {
  if (!isStaff(auth)) throw new HttpError(403, "Acesso negado.");
  const drive = await getIntegration("google_drive");
  if (!drive?.enabled) return json({ files: [] });
  const config = drive.config || {};
  const apiKey = config.api_key || "";
  const folderId = url.searchParams.get("folder_id") || config.folder_id || "";
  if (!apiKey || !folderId) throw bad("Configure API key e pasta do Google Drive.");
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,thumbnailLink)");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${encodeURIComponent(apiKey)}&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  if (!res.ok) throw bad("Não foi possível listar imagens do Google Drive.");
  const data = await res.json();
  const files = (data.files || []).map((f: Row) => ({
    id: f.id,
    name: f.name,
    thumb: f.thumbnailLink || `https://drive.google.com/uc?export=view&id=${f.id}`,
    url: `https://drive.google.com/uc?export=view&id=${f.id}`,
  }));
  return json({ files });
});

route("GET", "/stores", async () => {
  const { data } = await db.from("physical_stores").select("*").eq("active", true).order("sort_order").order("name");
  return json({
    stores: (data || []).map((r) => ({
      id: r.id, name: r.name, province: r.province, address: r.address, phone: r.phone || "",
      hours: r.hours || "", image_url: r.image_url || fileUrl("physical_stores", r, "image"),
      latitude: r.latitude, longitude: r.longitude, maps_url: r.maps_url || "",
      email: r.email || "", whatsapp: r.whatsapp || "", pickup_enabled: r.pickup_enabled !== false,
    })),
  });
});

route("GET", "/book-collections", async () => {
  const { data } = await db.from("book_collections").select("*").eq("active", true).order("sort_order").order("created");
  return json({
    collections: (data || []).map((r) => ({
      id: r.id, title: r.title, slug: r.slug || "", description: r.description || "",
      cover: r.cover || fileUrl("book_collections", r, "cover_image"), featured: !!r.featured,
      marketing_tagline: r.marketing_tagline || "", seo_title: r.seo_title || "", seo_description: r.seo_description || "",
    })),
  });
});

route("GET", "/payment-methods", async () => {
  const { data } = await db.from("payment_methods").select("*").eq("enabled", true).order("sort_order").limit(50);
  return json({
    methods: (data || []).map((r) => ({
      id: r.id, name: r.name, code: r.code, type: r.type || "offline", instructions: r.instructions || "",
      account_info: r.account_info || "", qr_url: r.qr_url || fileUrl("payment_methods", r, "qr_code"), icon: r.icon || "",
      payment_link: r.payment_link || "",
    })),
  });
});

async function findOrderByNumberAndEmail(orderNumber: string, email: string) {
  const { data } = await db.from("orders").select("*")
    .or(`order_number.eq.${JSON.stringify(orderNumber)},id.eq.${JSON.stringify(orderNumber)}`)
    .ilike("customer_email", likeExact(email))
    .limit(1);
  return data?.[0] || null;
}

route("POST", "/track", async ({ body, ip }) => {
  if (!await checkRateLimit("track", ip, storeRules(await getSettings()).trackRate)) throw bad("Demasiadas tentativas. Aguarde um minuto.");
  const orderNumber = String(body.orderNumber || "").trim();
  const email = normalizeEmail(body.email || "");
  if (!orderNumber || !email) throw bad("Número da encomenda e email são obrigatórios.");
  const order = await findOrderByNumberAndEmail(orderNumber, email);
  if (!order) throw new HttpError(404, "Encomenda não encontrada. Verifique o número e o email.");
  return json({
    order_number: order.order_number, status: order.status, delivery_status: order.delivery_status || "received",
    total: order.total, customer_name: order.customer_name, phone: order.phone || "",
    delivery_relative_name: order.delivery_relative_name || "", delivery_relative_phone: order.delivery_relative_phone || "",
    address: order.address, city: order.city, delivery_province: order.delivery_province || "",
    delivery_municipality: order.delivery_municipality || "", delivery_locality: order.delivery_locality || "",
    delivery_street: order.delivery_street || "", delivery_reference: order.delivery_reference || "",
    delivery_address_full: order.delivery_address_full || order.address || "",
    delivery_confirmed_at: order.delivery_confirmed_at || "", delivery_confirmed_by: order.delivery_confirmed_by || "",
    delivery_recipient_name: order.delivery_recipient_name || "",
    // A imagem da assinatura não sai daqui: basta o número da encomenda e o email para
    // chegar a esta rota, e o número é curto. Quem confirmou a recepção vê-a na resposta
    // do /confirm-delivery; a equipa vê-a no painel (RLS) e no recibo.
    delivery_signature_present: !!order.delivery_signature_data,
    tracking_number: order.tracking_number || "", carrier: order.carrier || "",
    estimated_delivery: order.estimated_delivery || "", payment_status: order.payment_status || "pending",
    timeline: order.delivery_timeline || [], created: order.created,
    shipping_method: order.shipping_method || "", pickup_store: order.pickup_store || "",
  });
});

route("GET", "/geo/provinces", async () => {
  const { data } = await db.from("angola_provinces").select("id, name, slug, capital, sort_order").order("sort_order").limit(500);
  const provinces = data || [];
  return json({ provinces, version: "RGPH-2024", count: provinces.length });
});

route("GET", "/geo/municipalities", async ({ url }) => {
  let provinceId = (url.searchParams.get("province") || "").trim();
  if (!provinceId) throw bad("Parâmetro province obrigatório.");
  const { data: bySlug } = await db.from("angola_provinces").select("id").eq("slug", provinceId).limit(1);
  if (bySlug?.[0]) provinceId = bySlug[0].id;
  const { data } = await db.from("angola_municipalities").select("id, name, slug, sort_order, province")
    .eq("province", provinceId).order("sort_order").limit(500);
  const municipalities = data || [];
  return json({ municipalities, count: municipalities.length });
});

route("GET", "/geo/localities", async ({ url }) => {
  const municipalityId = (url.searchParams.get("municipality") || "").trim();
  if (!municipalityId) throw bad("Parâmetro municipality obrigatório.");
  const { data } = await db.from("angola_localities").select("id, name, type, sort_order, municipality")
    .eq("municipality", municipalityId).order("sort_order").limit(500);
  const localities = data || [];
  return json({ localities, count: localities.length });
});

route("POST", "/confirm-delivery", async ({ body, ip }) => {
  const confirmRate = Math.max(1, Math.floor(storeRules(await getSettings()).trackRate / 2));
  if (!await checkRateLimit("confirm-delivery", ip, confirmRate)) throw bad("Demasiadas tentativas. Aguarde um minuto.");
  const orderNumber = String(body.orderNumber || "").trim();
  const email = normalizeEmail(body.email || "");
  const recipientName = String(body.recipientName || "").trim();
  const recipientId = String(body.recipientId || "").trim();
  const signature = String(body.signature || "").trim();
  if (!orderNumber || !email) throw bad("Número da encomenda e email são obrigatórios.");
  if (!recipientName) throw bad("Nome de quem recebe é obrigatório.");
  if (!signature.startsWith("data:image")) throw bad("Assinatura inválida.");
  if (signature.length > 600_000) throw bad("Assinatura demasiado grande.");

  const order = await findOrderByNumberAndEmail(orderNumber, email);
  if (!order) throw new HttpError(404, "Encomenda não encontrada.");
  if (order.delivery_confirmed_at) throw bad("Esta encomenda já foi confirmada pelo comprador.");
  const status = order.delivery_status || "received";
  if (!["shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) {
    throw bad("A encomenda ainda não está disponível para confirmação de recepção.");
  }
  // A linha temporal é escrita aqui; o trigger só acrescenta eventos quando o estado muda.
  const timeline = [...(order.delivery_timeline || []), timelineEvent(
    "delivered", "Recepção confirmada pelo comprador",
    `Assinatura digital registada por ${recipientName}${recipientId ? ` (doc. ${recipientId})` : ""}`,
    order.delivery_municipality || order.city || "",
  )];
  const { data: saved, error } = await db.from("orders").update({
    delivery_timeline: timeline,
    delivery_confirmed_at: nowISO(),
    delivery_confirmed_by: recipientName,
    delivery_recipient_name: recipientName,
    delivery_recipient_id: recipientId,
    delivery_signature_data: signature,
  }).eq("id", order.id).select().single();
  if (error) throw error;
  let final = saved;
  if (status !== "delivered") {
    // O trigger regista "Entregue" com o novo estado, como acontecia no hook do PocketBase.
    const { data, error: e2 } = await db.from("orders").update({ delivery_status: "delivered" }).eq("id", order.id).select().single();
    if (e2) throw e2;
    final = data;
    // Comprovativo da entrega para o cliente. A chave de idempotência é a mesma que o
    // painel usaria ao marcar "Entregue", por isso a confirmação não gera dois emails.
    try {
      await sendOrderStatusEmail(final, await getSettings(), "delivered", {
        description: `Recepção confirmada por ${recipientName}.`,
      });
    } catch (err) {
      console.log("Email de entrega confirmada:", err);
    }
  }
  return json({
    order_number: final.order_number, delivery_status: final.delivery_status,
    delivery_confirmed_at: final.delivery_confirmed_at, delivery_confirmed_by: final.delivery_confirmed_by,
    delivery_recipient_name: final.delivery_recipient_name, delivery_signature_data: final.delivery_signature_data,
    timeline: final.delivery_timeline,
  });
});

/**
 * Muda o estado do pagamento de uma encomenda e avisa o cliente quando fica pago.
 *
 * Esta rota existe porque o painel actualizava `payment_status` directamente na tabela, e
 * nesse caminho não passa nenhum código que possa enviar um email: o cliente nunca sabia que
 * o pagamento tinha sido aceite. Aqui a mudança e o aviso ficam no mesmo sítio, do lado do
 * servidor, que é também quem tem a permissão para decidir.
 */
route("POST", "/admin/orders/payment-status", async ({ auth, body }) => {
  requirePermission(auth, "manage_orders");
  const id = String(body.orderId || "").trim();
  const status = String(body.status || "").trim();
  if (!id) throw bad("orderId obrigatório.");
  if (!["pending", "awaiting_confirmation", "paid", "failed"].includes(status)) {
    throw bad("Estado de pagamento inválido.");
  }
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) throw new HttpError(404, "Encomenda não encontrada.");

  let saved = order;
  if (order.payment_status !== status) {
    const { data, error } = await db.from("orders").update({ payment_status: status }).eq("id", id).select().single();
    if (error) throw error;
    saved = data;
  }

  // Só o pagamento aceite gera mensagem: "pendente" ou "falhou" são estados internos, e o
  // cliente é avisado disso pelo meio por onde está a pagar, não por um email da loja.
  let emailSent = false;
  if (status === "paid" && order.payment_status !== "paid") {
    try {
      emailSent = await sendPaymentConfirmedEmail(saved, await getSettings());
    } catch (err) {
      console.log("Email de pagamento confirmado:", err);
    }
  }
  return json({ payment_status: saved.payment_status, email_sent: emailSent });
});

route("POST", "/delivery-event", async ({ auth, body }) => {
  requirePermission(auth, "manage_orders");
  if (!body.orderId) throw bad("orderId obrigatório.");
  const { data: order } = await db.from("orders").select("*").eq("id", body.orderId).maybeSingle();
  if (!order) throw new HttpError(404, "Encomenda não encontrada.");
  const timeline = [...(order.delivery_timeline || []), timelineEvent(
    body.status || "in_transit", body.title || "Actualização de entrega", body.description || "", body.location || "",
  )];
  const patch: Row = { delivery_timeline: timeline };
  if (body.tracking_number) patch.tracking_number = body.tracking_number;
  if (body.carrier) patch.carrier = body.carrier;
  if (body.estimated_delivery) patch.estimated_delivery = body.estimated_delivery;
  let { data: saved, error } = await db.from("orders").update(patch).eq("id", order.id).select().single();
  if (error) throw error;
  let statusChanged = false;
  if (body.status && body.status !== order.delivery_status) {
    ({ data: saved, error } = await db.from("orders").update({ delivery_status: body.status }).eq("id", order.id).select().single());
    if (error) throw error;
    statusChanged = true;
  }
  // O email vai só quando o estado muda de facto: gravar a mesma etapa outra vez no painel
  // não é novidade para o cliente. A falha de envio não desfaz a actualização da encomenda.
  let emailSent = false;
  if (statusChanged) {
    try {
      emailSent = await sendOrderStatusEmail(saved, await getSettings(), body.status, {
        description: body.description || "",
      });
    } catch (err) {
      console.log("Email de estado da encomenda:", err);
    }
  }
  return json({ timeline: saved.delivery_timeline, email_sent: emailSent });
});

route("POST", "/checkout", async ({ body: data, ip }) => {
  const settings = await getSettings();
  const rules = storeRules(settings);
  if (!await checkRateLimit("checkout", ip, rules.checkoutRate)) throw bad("Demasiadas tentativas de checkout. Aguarde um minuto.");
  const items: Row[] = data.items || [];
  if (!items.length) throw bad("Carrinho vazio.");

  // Textos com tamanho máximo, para ninguém encher a base de dados.
  const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  const email = clip(data.customerEmail, 254);
  const name = clip(data.customerName, 120);
  const phone = clip(data.phone, 40);
  const address = clip(data.address, 500);
  const shippingMethod = ["delivery", "express", "pickup"].includes(data.shippingMethod) ? data.shippingMethod : "delivery";
  const pickupStore = clip(data.pickupStore, 120);

  // Levantamento na loja: a loja só precisa de saber quem vem buscar e como lhe ligar.
  // Nem morada (não há entrega), nem assinatura (os livros são entregues ao balcão), nem
  // email (o recibo é dado na hora). Entrega ao domicílio continua a exigir tudo.
  const isPickup = shippingMethod === "pickup";
  if (!name) throw bad("Nome obrigatório.");
  if (!phone) throw bad("Telefone obrigatório.");
  if (!isPickup && !email) throw bad("Email obrigatório para entrega ao domicílio.");
  if (!isPickup) {
    if (!data.deliveryProvince) throw bad("Província de entrega obrigatória.");
    if (!data.deliveryMunicipality) throw bad("Município de entrega obrigatório.");
    if (!data.deliveryLocality) throw bad("Bairro/comuna/localidade obrigatória.");
    if (!String(data.deliveryStreet || "").trim()) throw bad("Morada (rua/avenida) obrigatória.");
    if (!String(data.deliveryReference || "").trim()) throw bad("Ponto de referência obrigatório para entrega.");
    if (!address) throw bad("Morada de entrega incompleta.");
  }
  if (isPickup && !pickupStore && !address) throw bad("Seleccione a loja de levantamento.");

  // Assinatura: obrigatória na entrega (é a prova de quem recebeu), opcional no levantamento.
  const signature = typeof data.checkoutSignature === "string" ? data.checkoutSignature : "";
  const signatureOk = signature.startsWith("data:image/png;base64,") && signature.length <= 200000;
  if (!isPickup && !signatureOk) {
    throw bad("Assinatura do comprador obrigatória. Assine no quadro.");
  }
  if (isPickup && signature && !signatureOk) throw bad("Assinatura inválida.");

  if (settings?.maintenance_mode) throw bad("Loja em manutenção. Tente mais tarde.");

  const parseBookId = (variantId: string) => String(variantId || "").replace(/-(default|v\d+)$/, "");
  const cartItems = items.map((item) => {
    const bookId = parseBookId(item.variant_id || item.book_id || "");
    if (!bookId) throw bad("Item inválido no carrinho.");
    return { book_id: bookId, quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), 99) };
  });

  const paymentCode = clip(data.paymentMethodCode || data.paymentMethod || "entrega", 60);
  // Só os métodos de pagamento que o admin tem activos. Se nenhum estiver activo, aceita "entrega".
  const { data: activeMethods } = await db.from("payment_methods").select("code, name, type, requires_reference").eq("enabled", true);
  const paymentMethodRow = (activeMethods || []).find((m: Row) => m.code === paymentCode);
  if (!paymentMethodRow && !(paymentCode === "entrega" && !(activeMethods || []).length)) throw bad("Método de pagamento indisponível.");
  // Pelo tipo configurado em Pagamentos: P2P e transferência são pagos antes da entrega, por isso
  // exigem referência e ficam "a aguardar confirmação"; os métodos offline (entrega, balcão) ficam pendentes.
  const paidUpfront = ["p2p", "transfer"].includes(paymentMethodRow?.type);
  if ((paidUpfront || paymentMethodRow?.requires_reference) && !clip(data.paymentReference, 120)) {
    throw bad("Indique a referência ou o comprovativo do pagamento.");
  }
  const isP2P = paidUpfront;
  const saleChannel = clip(data.saleChannel || data.orderType || "web_purchase", 40);
  const isWhatsApp = saleChannel === "whatsapp";
  const deliveryAddress = shippingMethod === "pickup" ? `Levantamento: ${pickupStore || "Loja física"}` : (clip(data.deliveryAddressFull, 600) || address);
  const deliveryCity = shippingMethod === "pickup" ? (pickupStore || "Loja física") : (clip(data.deliveryMunicipality || data.city, 120) || "Luanda");
  const timelineLocation = shippingMethod === "pickup" ? (pickupStore || "Loja física") : (clip(data.deliveryMunicipality || data.deliveryProvince, 120) || "Angola");
  // Hora + 3 caracteres aleatórios: evita números repetidos em compras simultâneas e números fáceis de adivinhar.
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
  const orderNum = rules.orderPrefix + Date.now().toString(36).toUpperCase().slice(-6) + randomPart;

  const order: Row = {
    order_number: orderNum,
    customer_email: email,
    customer_name: name,
    phone,
    address: deliveryAddress,
    city: deliveryCity,
    checkout_signature_data: signatureOk ? signature : "",
    checkout_signature_at: signatureOk ? nowISO() : null,
    shipping_method: shippingMethod,
    pickup_store: pickupStore,
    payment_method_code: paymentCode,
    payment_method_name: paymentMethodRow?.name || "",
    payment_reference: clip(data.paymentReference, 120),
    payment_status: isP2P ? "awaiting_confirmation" : "pending",
    delivery_status: "received",
    delivery_timeline: [timelineEvent(
      "received",
      isWhatsApp ? "Pedido via WhatsApp" : "Compra registada",
      isWhatsApp ? "Cliente iniciou pedido pelo WhatsApp." : "A sua compra foi registada com sucesso.",
      timelineLocation,
    )],
    status: "pending",
    sale_channel: saleChannel,
    order_type: isWhatsApp ? "whatsapp_order" : "online_purchase",
  };
  // Coordenadas da morada, quando o comprador as partilha. As colunas existiam desde o
  // início e nunca eram escritas — o estafeta não tinha como chegar a uma referência vaga.
  const gpsLat = Number(data.deliveryGpsLat);
  const gpsLng = Number(data.deliveryGpsLng);
  if (!isPickup && Number.isFinite(gpsLat) && Number.isFinite(gpsLng)
      && Math.abs(gpsLat) <= 90 && Math.abs(gpsLng) <= 180 && (gpsLat !== 0 || gpsLng !== 0)) {
    order.delivery_gps_lat = gpsLat;
    order.delivery_gps_lng = gpsLng;
  }
  if (paymentCode === "entrega" || paymentCode === "transferencia") order.payment_method = paymentCode;
  if (data.notes && rules.notesMax > 0) order.notes = clip(data.notes, rules.notesMax);
  if (shippingMethod !== "pickup") {
    Object.assign(order, {
      delivery_province_id: clip(data.deliveryProvinceId, 40),
      delivery_province: clip(data.deliveryProvince, 120),
      delivery_municipality_id: clip(data.deliveryMunicipalityId, 40),
      delivery_municipality: clip(data.deliveryMunicipality, 120),
      delivery_locality_id: clip(data.deliveryLocalityId, 40),
      delivery_locality: clip(data.deliveryLocality, 120),
      delivery_street: clip(data.deliveryStreet, 300),
      delivery_reference: clip(data.deliveryReference, 300),
      delivery_address_full: clip(data.deliveryAddressFull, 600) || deliveryAddress,
      delivery_relative_name: clip(data.deliveryRelativeName, 120),
      delivery_relative_phone: clip(data.deliveryRelativePhone, 40),
    });
  }

  const { data: saved, error } = await db.rpc("place_order", {
    p_order: order,
    p_items: cartItems,
    p_shipping: {
      method: shippingMethod,
      free_threshold: Number(settings?.shipping_free_threshold) || 20000,
      cost: Number(settings?.shipping_cost) || 1500,
      express_cost: Number(settings?.shipping_express_cost) || 0,
    },
  });
  if (error) throw bad(error.message);

  let emailSent = false;
  let whatsappSent = false;
  try {
    emailSent = await sendOrderConfirmationEmail(saved, settings);
    whatsappSent = await sendOrderWhatsAppConfirmation(saved, settings);
  } catch (err) {
    console.log("Post-checkout messaging:", err);
  }
  try {
    await upsertContact({
      name, email, phone, source: "checkout", is_buyer: true,
      tags: ["comprador", saleChannel || "web_purchase"],
      notes: `Encomenda ${orderNum} · ${fmtMoneyKz(saved.total)}`,
      metadata: { last_order_id: saved.id, last_order_number: orderNum },
    }, await getDefaultOwnerId());
  } catch (err) {
    console.log("Post-checkout CRM:", err);
  }

  const successUrl = data.successUrl || "/success";
  const sep = successUrl.includes("?") ? "&" : "?";
  return json({
    url: `${successUrl}${sep}orderId=${saved.id}&orderNumber=${orderNum}&total=${saved.total}&type=${isWhatsApp ? "whatsapp" : "purchase"}`,
    orderId: saved.id,
    orderNumber: orderNum,
    total: saved.total,
    payment_status: saved.payment_status,
    order_type: saved.order_type,
    sale_channel: saleChannel,
    email_sent: emailSent,
    whatsapp_sent: whatsappSent,
  });
});

route("GET", "/messaging/status", async () => {
  const settings = await getSettings();
  const waRec = await getIntegration("whatsapp_business");
  const waCfg = await getWhatsAppConfig();
  return json({
    whatsapp: {
      enabled: !!waRec?.enabled,
      configured: !!waCfg,
      auto_send: waCfg ? waCfg.auto_send !== false : false,
      use_template: !!waCfg?.use_template,
    },
    email: { enabled: !!settings?.order_email_enabled, provider: settings?.email_provider || "smtp" },
    push: { enabled: !!settings?.push_enabled, has_vapid: !!settings?.vapid_public_key },
  });
});

// Recibo por WhatsApp: só para o telefone registado na encomenda e com o texto montado aqui,
// a partir da encomenda. O texto enviado pelo browser é ignorado, para que ninguém use o número
// oficial da loja para mandar mensagens escritas por si.
function buildReceiptText(order: Row, siteName: string, paymentLink = "") {
  const lines = [
    `🧾 *Recibo — ${siteName}*`, `Nº: ${order.order_number || ""}`, "",
    `Olá ${order.customer_name || ""}!`, "", "*Livros:*",
    ...(order.items || []).map((it: Row) => `• ${it.quantity || 1}× ${it.title || "Livro"} — ${fmtMoneyKz(Number(it.price || 0) * Number(it.quantity || 1))}`),
  ];
  if (Number(order.shipping_cost)) lines.push(`Portes: ${fmtMoneyKz(order.shipping_cost)}`);
  lines.push("", `*Total: ${fmtMoneyKz(order.total)}*`);
  if (order.payment_method_name || order.payment_method) lines.push(`Pagamento: ${order.payment_method_name || order.payment_method}`);
  if (paymentLink) lines.push(`Link de pagamento: ${paymentLink}`);
  lines.push("", "Obrigado pela sua compra! 📚");
  return lines.join("\n");
}

route("POST", "/whatsapp/receipt", async ({ body, ip }) => {
  if (!await checkRateLimit("whatsapp_receipt", ip, 10)) throw bad("Demasiados pedidos. Aguarde um minuto.");
  const orderNumber = String(body.order_number || "").trim();
  const email = normalizeEmail(body.email || "");
  if (!orderNumber || !email) throw bad("Número da encomenda e email são obrigatórios.");
  const order = await findOrderByNumberAndEmail(orderNumber, email);
  if (!order) throw bad("Encomenda não encontrada.");
  const phone = String(order.phone || "").trim();
  const reqPhone = normalizePhone(String(body.phone || ""));
  if (!phone) return json({ sent: false, fallback: true, message: "A encomenda não tem telefone — use o link manual." });
  if (reqPhone && reqPhone !== normalizePhone(phone)) throw bad("Telefone não corresponde à encomenda.");
  const settings = await getSettings();
  if (!await checkRateLimit("whatsapp_receipt_order", order.id, storeRules(settings).receiptPerOrder)) throw bad("O recibo desta encomenda já foi enviado. Aguarde um minuto.");
  const config = await getWhatsAppConfig();
  if (!config) return json({ sent: false, fallback: true, message: "API WhatsApp não configurada — use link manual." });
  const text = buildReceiptText(order, settings?.site_name || "Livraria Adventista", await orderPaymentLink(order));
  const result = await sendWhatsAppMessage(phone, text, config, undefined, { context: "receipt", customer_name: order.customer_name, order_number: order.order_number });
  return json({
    sent: !!result.ok,
    fallback: !result.ok,
    message: result.ok ? "Recibo enviado por WhatsApp." : (result.error || "Falha no envio."),
  });
});

route("POST", "/admin/whatsapp/test", async ({ auth, body }) => {
  requirePermission(auth, "manage_settings");
  const phone = String(body.phone || "").trim();
  if (!phone) throw bad("Indique um número de teste.");
  const config = await getWhatsAppConfig();
  if (!config) throw bad("WhatsApp Business API não está activa ou configurada.");
  const text = "✅ Teste — Livraria Adventista\n\nA integração WhatsApp Business API está funcional. Mensagens automáticas activas.";
  const result = await sendWhatsAppMessage(phone, text, config, { bodyParams: ["Teste", "OK", "0 Kz"] }, { context: "test" });
  if (!result.ok) throw bad(`Falha Meta API (${result.status || ""}): ${result.error || "erro desconhecido"}`);
  return json({ message: `Mensagem de teste enviada para ${phone}.` });
});

/** Lista dos modelos que o painel pode pré-visualizar. */
/**
 * Cancelar a subscrição de campanhas, pelo token que vai no rodapé das mensagens.
 *
 * Pública e sem sessão: quem quer sair de uma lista não deve ter de criar conta nem entrar.
 * O token é opaco, de 64 caracteres, por contacto e revogável — é por isso que não vai aqui
 * o email, que ficaria exposto nos registos do servidor e no histórico do navegador.
 *
 * Responde sempre o mesmo com um token inválido: dizer "não existe" transformaria esta rota
 * num meio de confirmar se um token é de alguém.
 */
route("POST", "/unsubscribe", async ({ body, ip }) => {
  if (!await checkRateLimit("unsubscribe", ip, 20)) throw bad("Demasiados pedidos. Aguarde um minuto.");
  const token = String(body.token || "").trim();
  const done = { message: "Deixou de receber campanhas e novidades desta loja." };
  if (!/^[a-f0-9]{64}$/.test(token)) return json(done);
  const { data: contact } = await db.from("contacts")
    .select("id, tags, marketing_opt_out_at").eq("unsubscribe_token", token).maybeSingle();
  if (!contact) return json(done);
  // Grava a data e acrescenta a etiqueta que o painel já usava: a equipa vê o contacto como
  // "não contactar" na lista, sem ter de aprender um segundo sítio onde olhar, e a decisão
  // vale para todos os canais e não só para o email.
  if (!isOptedOut(contact)) {
    const tags = Array.isArray(contact.tags) ? contact.tags.map(String) : [];
    await db.from("contacts").update({
      marketing_opt_out_at: nowISO(),
      tags: tags.includes(OPT_OUT_TAG) ? tags : [...tags, OPT_OUT_TAG],
    }).eq("id", contact.id);
  }
  return json(done);
});

/** Categorias opcionais de email, para o painel ligar e desligar. */
route("GET", "/admin/email/categories", async ({ auth }) => {
  requirePermission(auth, "manage_settings");
  return json({ categories: categoryStates(await getSettings()) });
});

route("POST", "/admin/email/categories", async ({ auth, body }) => {
  requirePermission(auth, "manage_settings");
  const settings = await getSettings();
  if (!settings) throw bad("Configurações do site em falta.");
  // Só as chaves conhecidas entram: um valor qualquer vindo do pedido não pode ficar
  // guardado a fingir-se de categoria.
  const incoming = body.categories && typeof body.categories === "object" ? body.categories : {};
  const next: Row = {};
  for (const { key } of categoryStates(settings)) {
    next[key] = incoming[key] !== false;
  }
  const { error } = await db.from("site_settings").update({ email_categories: next }).eq("id", settings.id);
  if (error) throw error;
  return json({ categories: categoryStates({ ...settings, email_categories: next }) });
});

/**
 * Faz correr a fila a partir de um agendador, sem sessão de utilizador.
 *
 * O `pg_cron` não tem sessão nem token do Supabase Auth, por isso esta rota autentica-se com
 * um segredo partilhado em `EMAIL_QUEUE_TOKEN` (definido nos segredos da Edge Function, não
 * no repositório). É propositadamente uma rota separada da do painel: esta não dá acesso a
 * mais nada, e o segredo que a abre não serve para o resto da API.
 *
 * Sem o segredo definido, responde 404 como qualquer caminho desconhecido — uma rota que
 * respondesse "falta configurar" anunciava a quem passasse que existe aqui algo por fechar.
 */
route("POST", "/cron/email-queue", async ({ req, body, ip }) => {
  const expected = Deno.env.get("EMAIL_QUEUE_TOKEN") || "";
  if (!expected) return json({ message: "Rota não encontrada." }, 404);
  if (!await checkRateLimit("cron-queue", ip, 30)) throw bad("Demasiados pedidos.");
  const given = (req.headers.get("x-queue-token") || "").trim();
  if (!secretsMatch(given, expected)) throw new HttpError(401, "Token inválido.");
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 50);
  const summary = await processEmailQueue(limit);
  console.log("Fila de emails (cron):", JSON.stringify(summary));
  return json(summary);
});

/** Estado da fila de recuperação, para o painel. */
route("GET", "/admin/email/queue", async ({ auth }) => {
  requirePermission(auth, "manage_settings");
  const { data } = await db.from("email_queue")
    .select("id, recipient, subject, context, status, attempts, max_attempts, next_attempt_at, last_error, created")
    .order("created", { ascending: false })
    .limit(50);
  const rows = data || [];
  // Se o agendador está mesmo a correr, ou se a fila só anda com o botão. Sem isto, o painel
  // mostrava a fila a encher sem dizer porquê.
  const { data: scheduler } = await db.rpc("email_queue_scheduler_status");
  return json({
    jobs: rows,
    scheduler: scheduler || { available: false, reason: "Função de diagnóstico ainda não publicada." },
    summary: {
      pending: rows.filter((r: Row) => r.status === "pending").length,
      sending: rows.filter((r: Row) => r.status === "sending").length,
      failed: rows.filter((r: Row) => r.status === "failed").length,
    },
  });
});

/**
 * Corre um lote da fila.
 *
 * Existe como rota porque esta Edge Function não tem processo a correr entre pedidos: alguém
 * tem de a chamar. Serve o botão do painel e também um agendador externo (pg_cron com
 * pg_net, ou uma tarefa agendada) quando houver um.
 */
route("POST", "/admin/email/queue/run", async ({ auth, body }) => {
  requirePermission(auth, "manage_settings");
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
  return json(await processEmailQueue(limit));
});

/** Devolve uma mensagem desistida à fila, para nova tentativa à mão. */
route("POST", "/admin/email/queue/retry", async ({ auth, body }) => {
  requirePermission(auth, "manage_settings");
  const id = String(body.id || "").trim();
  if (!id) throw bad("id obrigatório.");
  const { data: job } = await db.from("email_queue").select("id, status").eq("id", id).maybeSingle();
  if (!job) throw new HttpError(404, "Mensagem não encontrada na fila.");
  if (job.status === "sent") throw bad("Esta mensagem já foi enviada.");
  // As tentativas voltam a zero: é uma decisão nova de uma pessoa, e não a continuação da
  // série que já tinha desistido.
  const { error } = await db.from("email_queue").update({
    status: "pending", attempts: 0, next_attempt_at: nowISO(), locked_at: null,
  }).eq("id", id);
  if (error) throw error;
  return json({ message: "Mensagem devolvida à fila." });
});

route("GET", "/admin/email/templates", async ({ auth }) => {
  requirePermission(auth, "manage_settings");
  const settings = await getSettings();
  const brand = emailBrand(settings);
  const templates = Object.entries(PREVIEW_TEMPLATES).map(([key, t]) => ({
    key, label: t.label, group: t.group, subject: t.build(brand).subject,
  }));
  return json({
    templates,
    // O painel avisa quando falta algo para as mensagens saírem de facto.
    ready: {
      enabled: !!settings?.order_email_enabled,
      provider: settings?.email_provider || "smtp",
      configured: settings?.email_provider === "sendgrid" ? !!settings?.sendgrid_api_key : !!settings?.smtp_host,
      site_url: brand.siteUrl,
      logo: brand.logoUrl,
    },
  });
});

/**
 * Pré-visualização de um modelo, com dados de exemplo.
 *
 * Passa pelas mesmas funções que enviam de verdade e devolve o HTML tal como sai, para o que
 * o gestor vê ser o que o cliente recebe. Um exemplo montado no painel seria um segundo sítio
 * a divergir deste com o tempo.
 */
route("GET", "/admin/email/preview", async ({ auth, url }) => {
  requirePermission(auth, "manage_settings");
  const key = String(url.searchParams.get("template") || "");
  const template = PREVIEW_TEMPLATES[key];
  if (!template) throw bad("Modelo desconhecido.");
  const settings = await getSettings();
  const brand = emailBrand(settings);
  const letter = template.build(brand);
  const { html, text } = emailDocument(brand, letter.doc);
  return json({ key, label: template.label, subject: letter.subject, html, text });
});

/**
 * Reenvia uma mensagem que já foi composta, a partir do registo de envios.
 *
 * Reenvia o conteúdo guardado e não o volta a compor: a encomenda pode ter mudado entretanto,
 * e o que se quer aqui é repetir a mensagem que falhou, não enviar outra diferente. Sem chave
 * de idempotência, porque um reenvio é precisamente um envio a mais, pedido à mão.
 */
route("POST", "/admin/email/resend", async ({ auth, body }) => {
  requirePermission(auth, "manage_settings");
  const id = String(body.logId || "").trim();
  if (!id) throw bad("logId obrigatório.");
  const { data: log } = await db.from("notification_logs").select("*").eq("id", id).maybeSingle();
  if (!log) throw new HttpError(404, "Registo não encontrado.");
  if (log.type !== "email") throw bad("Só é possível reenviar mensagens de email.");
  if (!log.recipient) throw bad("Este registo não tem destinatário.");
  // As de marketing ficam de fora: repetir uma campanha à mão é um envio em massa sem o
  // consentimento ter sido verificado outra vez.
  if (log.context === "campaign") throw bad("As campanhas não se reenviam a partir do registo.");
  if (!log.content) throw bad("Este registo não guardou o conteúdo da mensagem.");
  const settings = await getSettings();
  const ok = await sendTransactionalEmail(settings, log.recipient, log.subject || "", log.content, {
    context: log.context, customer_name: log.customer_name, order_number: log.order_number,
  });
  if (!ok) throw bad("O reenvio falhou. Veja o motivo no registo de comunicações.");
  return json({ message: `Mensagem reenviada para ${log.recipient}.` });
});

route("POST", "/admin/email/test", async ({ auth, body }) => {
  requirePermission(auth, "manage_settings");
  const to = normalizeEmail(body.to || auth?.email || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw bad("Indique um email de teste válido.");
  const settings = await getSettings();
  const ok = await sendLetter(settings, to, testLetter(emailBrand(settings)), { context: "test" });
  if (!ok) throw bad("O email não foi enviado. Veja o motivo no registo de comunicações.");
  return json({ message: `Email de teste enviado para ${to}.` });
});

route("GET", "/push/config", async () => {
  const rec = await getSettings();
  if (!rec?.push_enabled) return json({ enabled: false, publicKey: "" });
  return json({ enabled: true, publicKey: rec.vapid_public_key || "" });
});

route("POST", "/push/subscribe", async ({ auth, body, ip }) => {
  if (!await checkRateLimit("push-subscribe", ip, 10)) throw bad("Demasiados pedidos. Aguarde um minuto.");
  const endpoint = String(body.endpoint || "").trim();
  if (!/^https:\/\/[^\s]{8,1000}$/.test(endpoint)) throw bad("Endpoint inválido.");
  const keys = body.keys && typeof body.keys === "object"
    ? { p256dh: String(body.keys.p256dh || "").slice(0, 200), auth: String(body.keys.auth || "").slice(0, 100) }
    : {};
  const rec: Row = { endpoint, keys, user_agent: String(body.user_agent || "").slice(0, 300) };
  if (auth?.id) rec.user = auth.id;
  const { error } = await db.from("push_subscriptions").upsert(rec, { onConflict: "endpoint" });
  if (error) throw error;
  return json({ message: "Subscrição push registada." });
});

route("POST", "/contact-message", async ({ body, ip }) => {
  if (!await checkRateLimit("contact", ip, 8)) throw bad("Demasiados pedidos. Aguarde um minuto.");
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email || "");
  const message = String(body.message || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || !email || !message) throw bad("Nome, email e mensagem são obrigatórios.");
  await upsertContact({ name, email, phone, source: "manual", notes: message, tags: ["formulario-contacto"] }, await getDefaultOwnerId());
  return json({ message: "Mensagem recebida! Entraremos em contacto em breve." });
});

route("POST", "/contacts/sync-batch", async ({ auth, body }) => {
  const staff = requireCrm(auth);
  const items: Row[] = body.contacts || [];
  if (!items.length) throw bad("Lista de contactos vazia.");
  let created = 0, updated = 0, skipped = 0;
  for (const item of items) {
    if (!item.name && !item.email && !item.phone) { skipped++; continue; }
    const result = await upsertContact(item, staff.id);
    if (result.created) created++; else updated++;
  }
  return json({ message: "Sincronização concluída.", created, updated, skipped, total: items.length });
});

route("POST", "/contacts/import-sources", async ({ auth }) => {
  const staff = requireCrm(auth);
  let created = 0, updated = 0;
  const { data: orders } = await db.from("orders").select("customer_email, phone, customer_name");
  for (const o of orders || []) {
    if (!o.customer_email && !o.phone) continue;
    const r = await upsertContact({
      name: o.customer_name || "Cliente", email: o.customer_email || "", phone: o.phone || "",
      source: "order", is_buyer: true, tags: ["comprador"],
    }, staff.id);
    if (r.created) created++; else updated++;
  }
  const { data: subs } = await db.from("newsletter").select("email");
  for (const s of subs || []) {
    if (!s.email) continue;
    const r = await upsertContact({ name: s.email.split("@")[0], email: s.email, source: "newsletter", tags: ["newsletter"] }, staff.id);
    if (r.created) created++; else updated++;
  }
  return json({ message: "Importação concluída.", created, updated });
});

route("GET", "/contacts/stats", async ({ auth }) => {
  requireCrm(auth);
  return json({
    total: await countRows("contacts"),
    google: await countRows("contacts", (q) => q.eq("source", "google")),
    buyers: await countRows("contacts", (q) => q.eq("is_buyer", true)),
    groups: await countRows("contact_groups"),
    active_campaigns: await countRows("contact_campaigns", (q) => q.eq("is_active", true)),
  });
});

route("POST", "/contacts/notify", async ({ auth, body }) => {
  const staff = requireCrm(auth);
  const contactIds: string[] = Array.isArray(body.contact_ids) ? [...new Set(body.contact_ids.map(String))] : [];
  const channel = ["whatsapp", "email", "both"].includes(body.channel) ? body.channel : "whatsapp";
  const subject = clipText(body.subject || "Novidades — Livraria Adventista", 200);
  const text = clipText(body.body || "", 4000);
  if (!contactIds.length) throw bad("Seleccione pelo menos um contacto.");
  if (contactIds.length > MAX_NOTIFY_CONTACTS) throw bad(`Envie no máximo ${MAX_NOTIFY_CONTACTS} contactos de cada vez.`);
  if (text.trim().length < 5) throw bad("Escreva a mensagem a enviar.");
  const settings = await getSettings();
  const { data: contacts } = await db.from("contacts").select("*").in("id", contactIds);
  const results = [];
  let skipped = 0;
  for (const contact of contacts || []) {
    if (isOptedOut(contact)) { skipped++; continue; }
    const r = await notifyContact(contact, { channel, subject, body: text, settings, owner: staff.id, groupId: body.group_id || "" });
    results.push({
      contact_id: contact.id, name: contact.name, email: contact.email || "", phone: contact.phone || "",
      whatsapp_url: r.waUrl, whatsapp_api_sent: r.whatsappApiSent, email_sent: r.emailSent, channel, status: r.status,
    });
  }
  return json({ message: "Notificações processadas.", results, skipped_opt_out: skipped, whatsapp_api: !!(await getWhatsAppConfig()) });
});

route("POST", "/contacts/campaigns/run-due", async ({ auth }) => {
  const staff = requireCrm(auth);
  const now = nowISO();
  const { data: campaigns } = await db.from("contact_campaigns").select("*").eq("is_active", true).limit(50);
  const digest = await getNewBooksDigest();
  const settings = await getSettings();
  let processed = 0;
  const notifications = [];
  for (const camp of campaigns || []) {
    if (camp.next_send_at && camp.next_send_at > now) continue;
    if (!camp.group) continue;
    const { data: group } = await db.from("contact_groups").select("*").eq("id", camp.group).maybeSingle();
    const memberIds: string[] = group?.member_ids || [];
    if (!memberIds.length) continue;
    let text = camp.message_template || "";
    if (camp.include_new_books && digest) text = text ? `${text}\n\n${digest}` : digest;
    const channel = camp.channel || "whatsapp";
    const subject = camp.subject || "Novidades — Livraria Adventista";
    const { data: contacts } = await db.from("contacts").select("*").in("id", memberIds);
    for (const contact of contacts || []) {
      if (isOptedOut(contact)) continue;
      const r = await notifyContact(contact, {
        channel, subject, body: text, settings, owner: staff.id, groupId: camp.group, campaignId: camp.id,
      });
      notifications.push({ campaign: camp.name, contact: contact.name, whatsapp_url: r.waUrl, status: r.status });
    }
    await db.from("contact_campaigns").update({
      last_sent_at: now, next_send_at: calcNextSendAt(camp.frequency || "weekly"),
    }).eq("id", camp.id);
    processed++;
  }
  return json({ message: "Campanhas processadas.", processed, notifications });
});

route("POST", "/newsletter", async ({ body, ip }) => {
  if (!await checkRateLimit("newsletter", ip, 6)) throw bad("Demasiadas tentativas. Aguarde um minuto.");
  const email = normalizeEmail(body.email || "");
  if (!email) throw bad("Email obrigatório.");
  const { data } = await db.from("newsletter").select("id").ilike("email", likeExact(email)).limit(1);
  if (data?.[0]) return json({ message: "Já subscrito." });
  const { error } = await db.from("newsletter").insert({ email });
  if (error) throw error;
  return json({ message: "Subscrição realizada!" });
});

route("GET", "/catalog/summary", async () => {
  const { data: books } = await db.from("stock_books")
    .select("id, title, book_code, stock, stock_low, genre, featured, cover, cover_image, sales_count").eq("active", true).order("title").limit(500);
  const genres: Record<string, Row> = {};
  let inStock = 0, featured = 0, lowStock = 0, outOfStock = 0, withCover = 0;
  const topSellers = [];
  for (const b of books || []) {
    const stock = Number(b.stock) || 0;
    const genre = b.genre || "Catálogo Geral";
    genres[genre] ||= { name: genre, total: 0, in_stock: 0 };
    genres[genre].total++;
    if (stock > 0) { genres[genre].in_stock++; inStock++; } else outOfStock++;
    if (b.featured) featured++;
    // Marca da base de dados, com o limite de Configurações → Regras da loja.
    if (stock > 0 && b.stock_low) lowStock++;
    if (b.cover || b.cover_image) withCover++;
    topSellers.push({ id: b.id, title: b.title || "", book_code: b.book_code || "", sales_count: Number(b.sales_count) || 0, stock });
  }
  topSellers.sort((a, b) => b.sales_count - a.sales_count);
  return json({
    total: books?.length || 0, in_stock: inStock, out_of_stock: outOfStock, featured, low_stock: lowStock,
    with_cover: withCover, genres: Object.values(genres).sort((a, b) => b.total - a.total), top_sellers: topSellers.slice(0, 10),
  });
});

route("POST", "/catalog/view", async ({ body, ip }) => {
  if (!await checkRateLimit("catalog-view", ip, 60)) return json({ ok: true });
  const bookId = String(body.book_id || body.id || "").trim();
  if (!bookId) throw bad("book_id obrigatório.");
  const { data, error } = await db.rpc("increment_book_views", { p_id: bookId });
  if (error) throw error;
  if (data == null) throw new HttpError(404, "Livro não encontrado.");
  return json({ ok: true, views_count: data });
});

// --- Gestão de utilizadores e clientes (o frontend não tem a service role) ---
// Regras:
//  - É preciso a permissão "manage_users" (os administradores têm-na sempre).
//  - Gestores gerem clientes; contas da equipa, papéis e permissões só os administradores.
//  - Ninguém se apaga, suspende ou retira o próprio acesso de administrador.
//  - Tem de ficar sempre pelo menos um administrador activo.
const ROLES = ["member", "manager", "admin"];
const SUSPEND_FOR = "876000h"; // ~100 anos: suspensão até ser reactivada

function cleanPermissions(input: unknown): Row {
  const src = input && typeof input === "object" ? input as Row : {};
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, src[k] === true]));
}

const cleanText = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const isEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

function safeOrigin(origin: unknown) {
  try {
    const u = new URL(String(origin || ""));
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
  } catch {
    return "";
  }
}

async function loadTarget(auth: Auth, id: unknown) {
  // A permissão é verificada antes de ir à base de dados: a ordem inversa respondia 404 para
  // um id inexistente e 403 para um existente, o que dizia a qualquer pessoa quais os ids de
  // conta que existem — e fazia o servidor trabalhar para quem não tem acesso.
  requirePermission(auth, "manage_users");
  const targetId = cleanText(id, 64);
  if (!targetId) throw bad("id obrigatório.");
  const { data } = await db.from("profiles").select("id, role, name").eq("id", targetId).maybeSingle();
  if (!data) throw new HttpError(404, "Utilizador não encontrado.");
  const { data: authUser } = await db.auth.admin.getUserById(targetId);
  return { ...data, email: authUser?.user?.email || "" } as Row;
}

function assertCanManage(auth: Auth, target: Row) {
  requirePermission(auth, "manage_users");
  if (target.role !== "member" && auth!.role !== "admin") {
    throw new HttpError(403, "Só administradores podem gerir contas da equipa.");
  }
}

/** Administradores activos (não suspensos), sem contar com `excludeId`. */
async function activeAdminCount(excludeId = "") {
  const { data, error } = await db.rpc("admin_users_list", {
    p_scope: "team", p_search: "", p_status: "active", p_limit: 100, p_offset: 0,
  });
  if (error) throw bad(error.message);
  return (data?.items || []).filter((u: Row) => u.role === "admin" && u.id !== excludeId).length;
}

/** Gera um link para definir a palavra-passe e tenta enviá-lo pelo email da loja. */
async function sendAccessLink(email: string, name: string, kind: "invite" | "reset", origin: unknown) {
  const base = safeOrigin(origin);
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    ...(base ? { options: { redirectTo: `${base}/reset-password` } } : {}),
  });
  if (error) throw bad(error.message);
  const link = data?.properties?.action_link || "";
  const settings = await getSettings();
  const letter = accessLinkLetter(emailBrand(settings), name, kind, link);
  // Sem `dedupe`: um pedido novo de recuperação tem de gerar um email novo, porque o link
  // anterior deixa de servir.
  const emailSent = await sendLetter(settings, email, letter, { context: "account", customer_name: name });
  return { link, emailSent };
}

/**
 * Email de boas-vindas, pedido pela própria conta no primeiro acesso.
 *
 * O Supabase Auth cria a conta sem passar por aqui, por isso não há gancho no servidor para
 * o registo. A alternativa é esta: o cliente pede uma vez, e a chave de idempotência (a
 * conta) garante que só sai um email, por mais vezes que o pedido se repita. Vai sempre para
 * o email da sessão, nunca para um endereço vindo no corpo do pedido.
 */
route("POST", "/account/welcome", async ({ auth }) => {
  if (!auth?.email) throw new HttpError(401, "Sessão necessária.");
  const settings = await getSettings();
  const { data: profile } = await db.from("profiles").select("name").eq("id", auth.id).maybeSingle();
  const sent = await sendLetter(settings, auth.email, welcomeLetter(emailBrand(settings), profile?.name || ""), {
    context: "welcome",
    category: "welcome",
    customer_name: profile?.name || "",
    dedupe: `account:welcome:${auth.id}`,
  });
  return json({ email_sent: sent });
});

route("GET", "/admin/users", async ({ auth, url }) => {
  requirePermission(auth, "manage_users");
  const perPage = Math.min(Math.max(Number(url.searchParams.get("per_page")) || 25, 1), 100);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const scope = ["team", "customers", "all"].includes(url.searchParams.get("scope") || "") ? url.searchParams.get("scope") : "all";
  const { data, error } = await db.rpc("admin_users_list", {
    p_scope: scope,
    p_search: cleanText(url.searchParams.get("q"), 100),
    p_status: cleanText(url.searchParams.get("status"), 20) || "all",
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });
  if (error) throw bad(error.message);
  return json({ ...data, page, per_page: perPage });
});

route("GET", "/admin/users/orders", async ({ auth, url }) => {
  if (!can(auth, "manage_users") && !can(auth, "manage_orders")) throw new HttpError(403, "Sem permissão para esta operação.");
  const email = normalizeEmail(url.searchParams.get("email") || "");
  if (!isEmail(email)) throw bad("Email inválido.");
  const { data, error } = await db.from("orders")
    .select("id, order_number, created, total, status, payment_status, delivery_status, payment_method_name, items")
    .ilike("customer_email", likeExact(email))
    .order("created", { ascending: false })
    .limit(100);
  if (error) throw bad(error.message);
  return json({ items: data || [] });
});

route("POST", "/admin/users/create", async ({ auth, body }) => {
  requirePermission(auth, "manage_users");
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) throw bad("Indique um email válido.");
  const role = ROLES.includes(body.role) ? body.role : "member";
  if (role !== "member" && auth!.role !== "admin") throw new HttpError(403, "Só administradores podem criar contas da equipa.");
  const password = String(body.password || "");
  if (password && password.length < 8) throw bad("A palavra-passe deve ter pelo menos 8 caracteres.");
  const name = cleanText(body.name) || email.split("@")[0];

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: password || `${crypto.randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new HttpError(409, "Já existe uma conta com este email.");
    throw bad(error.message);
  }
  const id = created.user!.id;
  const { error: profileError } = await db.from("profiles").update({
    name,
    email,
    phone: cleanText(body.phone, 40),
    role,
    permissions: role === "manager" ? cleanPermissions(body.permissions) : null,
  }).eq("id", id);
  if (profileError) throw bad(profileError.message);

  let access = { link: "", emailSent: false };
  if (!password || body.send_link) access = await sendAccessLink(email, name, "invite", body.origin);
  return json({ id, email, ...access });
});

route("POST", "/admin/users/update", async ({ auth, body }) => {
  const target = await loadTarget(auth, body.id);
  assertCanManage(auth, target);
  const patch: Row = {};
  if (body.name !== undefined) patch.name = cleanText(body.name);
  if (body.phone !== undefined) patch.phone = cleanText(body.phone, 40);

  const roleChange = body.role !== undefined && body.role !== target.role;
  if (roleChange || body.permissions !== undefined) {
    if (auth!.role !== "admin") throw new HttpError(403, "Só administradores podem alterar papéis e permissões.");
    const role = body.role !== undefined ? body.role : target.role;
    if (!ROLES.includes(role)) throw bad("Papel inválido.");
    if (target.id === auth!.id && role !== "admin") throw bad("Não pode retirar o seu próprio acesso de administrador.");
    if (target.role === "admin" && role !== "admin" && await activeAdminCount(target.id) === 0) {
      throw bad("Tem de existir pelo menos um administrador activo.");
    }
    patch.role = role;
    patch.permissions = role === "manager" ? cleanPermissions(body.permissions) : null;
  }

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (!isEmail(email)) throw bad("Indique um email válido.");
    if (email !== normalizeEmail(target.email)) {
      const { error } = await db.auth.admin.updateUserById(target.id, { email, email_confirm: true });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) throw new HttpError(409, "Já existe uma conta com este email.");
        throw bad(error.message);
      }
      patch.email = email;
    }
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from("profiles").update(patch).eq("id", target.id);
    if (error) throw bad(error.message);
  }
  return json({ ok: true });
});

route("POST", "/admin/users/status", async ({ auth, body }) => {
  const target = await loadTarget(auth, body.id);
  assertCanManage(auth, target);
  const suspend = body.suspended === true;
  if (suspend && target.id === auth!.id) throw bad("Não pode suspender a sua própria conta.");
  if (suspend && target.role === "admin" && await activeAdminCount(target.id) === 0) {
    throw bad("Tem de existir pelo menos um administrador activo.");
  }
  const { error } = await db.auth.admin.updateUserById(target.id, { ban_duration: suspend ? SUSPEND_FOR : "none" });
  if (error) throw bad(error.message);
  return json({ ok: true, suspended: suspend });
});

route("POST", "/admin/users/access-link", async ({ auth, body }) => {
  const target = await loadTarget(auth, body.id);
  assertCanManage(auth, target);
  if (!target.email) throw bad("Esta conta não tem email.");
  const access = await sendAccessLink(target.email, target.name, "reset", body.origin);
  return json(access);
});

route("POST", "/admin/users/delete", async ({ auth, body }) => {
  const target = await loadTarget(auth, body.id);
  assertCanManage(auth, target);
  if (target.id === auth!.id) throw bad("Não pode apagar a sua própria conta.");
  if (target.role === "admin" && await activeAdminCount(target.id) === 0) {
    throw bad("Tem de existir pelo menos um administrador activo.");
  }
  // As encomendas ficam (estão ligadas ao email, não à conta).
  const { error } = await db.auth.admin.deleteUser(target.id);
  if (error) throw bad(error.message);
  return json({ ok: true });
});

// --- Assistente (antes: chat.pb.js) ---
const chatKeys = (settings: Row | null) => ({
  gemini: Deno.env.get("GEMINI_API_KEY") || settings?.gemini_api_key || "",
  deepseek: Deno.env.get("DEEPSEEK_API_KEY") || settings?.deepseek_api_key || "",
});

route("GET", "/chat/config", async () => {
  const settings = await getSettings();
  const keys = chatKeys(settings);
  const provider = settings ? (settings.chat_provider || "gemini") : "faq";
  let ai = false;
  let active = "faq";
  if (provider === "gemini" && keys.gemini) { ai = true; active = "gemini"; }
  else if (provider === "deepseek" && keys.deepseek) { ai = true; active = "deepseek"; }
  else if (keys.gemini) { ai = true; active = "gemini"; }
  return json({ enabled: settings ? settings.chat_enabled !== false : true, ai, provider: active, welcome: settings?.chat_welcome || "" });
});

function bookToChatItem(b: Row) {
  return {
    id: b.id, title: b.title || "", author: b.author || "", book_code: b.book_code || "",
    price: b.price ? `${effectivePrice(b)} Kz` : "", cover: fileUrl("stock_books", b, "cover_image") || b.cover || "",
    genre: b.genre || "", stock: Number(b.stock) || 0,
  };
}

async function searchBooks(query: string, limit = 8) {
  const q = (query || "").trim().toLowerCase().replace(/[,()"%]/g, " ").trim();
  const seen = new Set<string>();
  const books: Row[] = [];
  const add = (list: Row[] | null) => {
    for (const b of list || []) if (!seen.has(b.id)) { seen.add(b.id); books.push(b); }
  };
  const base = () => db.from("stock_books").select("*").eq("active", true).gt("stock", 0);
  if (q.length >= 2) {
    const like = `%${q}%`;
    add((await base().or(`title.ilike.${like},author.ilike.${like},genre.ilike.${like},book_code.ilike.${like}`)
      .order("featured", { ascending: false }).order("created", { ascending: false }).limit(limit)).data);
    if (books.length < limit) {
      add((await base().ilike("description", like)
        .order("featured", { ascending: false }).order("created", { ascending: false }).limit(limit - books.length)).data);
    }
  }
  if (!books.length) add((await base().eq("featured", true).order("created", { ascending: false }).limit(limit)).data);
  if (!books.length) add((await base().order("featured", { ascending: false }).order("created", { ascending: false }).limit(limit)).data);
  return books.slice(0, limit).map(bookToChatItem);
}

function parseAiJson(raw: string | null) {
  if (!raw) return null;
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  try {
    const obj = JSON.parse(text);
    return {
      reply: obj.reply || "",
      suggestions: Array.isArray(obj.suggestions) ? obj.suggestions.slice(0, 4) : [],
      links: Array.isArray(obj.links) ? obj.links.slice(0, 5) : [],
      product_ids: Array.isArray(obj.product_ids) ? obj.product_ids.slice(0, 4) : [],
    };
  } catch {
    return { reply: text.slice(0, 2000), suggestions: [], links: [], product_ids: [] };
  }
}

async function callGemini(apiKey: string, model: string, system: string, history: Row[], message: string) {
  const contents = history.filter((h) => h.content).map((h) => ({
    role: h.role === "assistant" ? "model" : "user", parts: [{ text: String(h.content).slice(0, 1200) }],
  }));
  contents.push({ role: "user", parts: [{ text: message.slice(0, 1200) }] });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.65, maxOutputTokens: 900, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callDeepseek(apiKey: string, model: string, system: string, history: Row[], message: string) {
  const messages = [{ role: "system", content: system }, ...history.filter((h) => h.content).map((h) => ({
    role: h.role === "assistant" ? "assistant" : "user", content: String(h.content).slice(0, 1200),
  })), { role: "user", content: message.slice(0, 1200) }];
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: 900, response_format: { type: "json_object" } }),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body?.choices?.[0]?.message?.content || null;
}

function faqFallback(message: string, settings: Row | null, books: Row[]) {
  const q = (message || "").toLowerCase();
  let reply: string;
  if (q.includes("envio") || q.includes("entrega")) reply = "A entrega padrão demora 5-7 dias úteis em Luanda e 7-14 noutras províncias.";
  else if (q.includes("grátis") || q.includes("gratis")) reply = "Envio grátis para encomendas acima do limiar configurado na loja.";
  else if (q.includes("pagamento") || q.includes("pagar")) reply = "Aceitamos transferência, Multicaixa Express e pagamento na entrega.";
  else if (q.includes("rastrear") || q.includes("encomenda")) reply = "Rastreie em /track com o número e email da compra.";
  else if (q.includes("catálogo") || q.includes("catalogo") || q.includes("livro")) {
    reply = books.length
      ? `Temos ${books.length} sugestões no catálogo, por exemplo «${books[0].title}». Explore /shop.`
      : "Explore o catálogo em /shop ou diga-me o tema que procura.";
  } else {
    const wa = settings?.whatsapp || settings?.contact_phone || "";
    reply = `Posso ajudar com envios, pagamentos e catálogo. Visite /contact${wa ? " ou WhatsApp " + wa : ""}.`;
  }
  return {
    reply,
    suggestions: ["Ver catálogo", "Envio grátis?", "Rastrear encomenda", "Falar com a equipa"],
    links: [{ label: "Loja", path: "/shop" }, { label: "FAQ", path: "/faq" }, { label: "Contacto", path: "/contact" }],
    product_ids: books.slice(0, 2).map((b) => b.id),
  };
}

route("POST", "/chat", async ({ body, ip }) => {
  if (!await checkRateLimit("chat", ip, 20)) throw bad("Demasiadas mensagens. Aguarde um minuto.");
  const message = String(body.message || "").trim();
  const page = String(body.page || "/").slice(0, 120);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8)
    .filter((h: Row) => h && (h.role === "user" || h.role === "assistant") && h.content);
  if (!message) throw bad("Mensagem vazia.");
  if (message.length > 800) throw bad("Mensagem demasiado longa.");

  const settings = await getSettings();
  if (settings && settings.chat_enabled === false) throw bad("Assistente temporariamente indisponível.");

  const books = await searchBooks(message, 8);
  const keys = chatKeys(settings);
  const pref = settings ? (settings.chat_provider || "gemini") : "faq";
  const model = settings?.chat_model || "";
  const site = settings?.site_name || "Livraria Adventista";
  const shipping = Number(settings?.shipping_free_threshold) || 20000;
  const catalog = books.map((b) => `- [${b.id}] ${b.title}${b.book_code ? ` (${b.book_code})` : ""} | ${b.author} | ${effectivePrice(b)} | stock:${b.stock}\n`).join("");
  const system = [
    `Assistente da ${site}. Responde em português de Portugal.`,
    "Só recomende livros do catálogo listado. Não invente títulos.",
    `Página: ${page || "/"}. Serviços: /shop, /track, /contact, /faq.`,
    `Envio grátis acima de ${Math.round(shipping)} Kz.`,
    `Catálogo (IDs reais):\n${catalog}`,
    'JSON: {"reply":"","suggestions":[],"links":[{"label":"","path":""}],"product_ids":[]}',
  ].join("\n");

  let parsed = null;
  let usedAi = false;
  let provider = "faq";
  if (pref !== "faq") {
    let use = "";
    if (pref === "gemini" && keys.gemini) use = "gemini";
    else if (pref === "deepseek" && keys.deepseek) use = "deepseek";
    else if (keys.gemini) use = "gemini";
    else if (keys.deepseek) use = "deepseek";
    const raw = use === "gemini"
      ? await callGemini(keys.gemini, model || "gemini-2.0-flash-lite", system, history, message)
      : use === "deepseek"
        ? await callDeepseek(keys.deepseek, model || "deepseek-chat", system, history, message)
        : null;
    if (raw) { parsed = parseAiJson(raw); usedAi = true; provider = use; }
  }
  if (!parsed) parsed = faqFallback(message, settings, books);

  const byId = Object.fromEntries(books.map((b) => [b.id, b]));
  let products = (parsed.product_ids || []).map((id: string) => byId[id]).filter(Boolean);
  if (!products.length && books.length) products = [books[0]];
  const links = parsed.links?.length ? parsed.links : [{ label: "Catálogo", path: "/shop" }];
  return json({ reply: parsed.reply || "", suggestions: parsed.suggestions || [], links, products: products.slice(0, 4), ai: usedAi, provider });
});

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/app/, "").replace(/\/$/, "") || "/";
  const handler = routes[`${req.method} ${path}`];
  if (!handler) return json({ message: "Rota não encontrada." }, 404);
  try {
    let body: Row = {};
    if (req.method === "POST") body = await req.json().catch(() => ({}));
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
    return await handler({ req, url, body, auth: await getAuth(req), ip });
  } catch (err) {
    if (err instanceof HttpError) return json({ message: err.message, status: err.status }, err.status);
    console.log(`Erro em ${req.method} ${path}:`, err);
    return json({ message: (err as { message?: string })?.message || String(err) }, 400);
  }
});
