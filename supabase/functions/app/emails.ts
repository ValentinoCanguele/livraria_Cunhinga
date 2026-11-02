/**
 * Identidade visual dos emails da loja.
 *
 * Um só sítio a montar a moldura (cabeçalho com logótipo, emblema, corpo, botões, rodapé
 * institucional) e a gerar, do mesmo conteúdo, as duas versões que cada mensagem tem de
 * levar: HTML e texto simples. Gerar as duas da mesma estrutura evita o que costuma
 * acontecer — a versão em texto fica para trás e deixa de dizer o mesmo que a de HTML.
 *
 * Regras que a compatibilidade com clientes de email impõe, e que explicam o aspecto do
 * código aqui:
 *
 * - **Tabelas, não `flex` nem `grid`.** O Outlook para Windows usa o motor do Word.
 * - **CSS sempre em linha.** O Gmail descarta `<style>` em boa parte dos casos.
 * - **Nada de SVG, JavaScript nem animações:** são bloqueados ou ignorados.
 * - **A mensagem tem de se ler sem imagens.** Muitos clientes bloqueiam-nas por omissão, por
 *   isso o emblema de cada tipo de email é desenhado com uma célula de tabela e um caracter,
 *   e não com uma imagem. Quando houver ilustrações próprias, passam-se em `heroImageUrl` e
 *   aparecem por cima do emblema, que continua a ser o recuo.
 * - **Largura de 600px**, a que todos os clientes mostram sem cortar, e que encolhe sozinha
 *   no telemóvel por a tabela ter `width:100%` com `max-width`.
 */

const BRAND_FALLBACK_COLOR = "#0ea5c9";
const INK = "#1a2733";
const INK_SOFT = "#5b6b7a";
const LINE = "#e3e8ed";
const PAPER = "#ffffff";
const CANVAS = "#f4f6f8";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type Brand = {
  siteName: string;
  logoUrl: string;
  color: string;
  siteUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
};

/**
 * Símbolos que os tipos de letra de sistema desenham mesmo (verificados no ecrã).
 *
 * Esta lista existe porque a tentativa anterior usava `⚿` (U+26BF) para a palavra-passe, e
 * esse caracter não tem glifo em Arial, Helvetica nem Segoe UI: o emblema do email de
 * recuperação saía como um bloco de riscas. Fora daqui, só acrescentar depois de ver
 * desenhado. Os emojis de relógio e ampulheta ficam de fora de propósito: alguns clientes
 * desenham-nos a cores e destoam do resto.
 */
export const SAFE_SYMBOLS = ["✓", "✔", "✕", "✖", "✉", "★", "☆", "→", "←", "↻", "↺", "●", "○", "■", "□", "▲", "▣", "◆", "◉", "◷", "✦", "✱", "✚", "➜", "⚑", "!", "?"] as const;

export type SafeSymbol = (typeof SAFE_SYMBOLS)[number];

/** Tons do emblema. Mantidos em poucos para as mensagens não parecerem de lojas diferentes. */
export type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: "#e6f6fb", fg: "#0b7f9e" },
  success: { bg: "#e7f6ec", fg: "#1a7f41" },
  warning: { bg: "#fdf3e3", fg: "#9a6212" },
  danger: { bg: "#fdebeb", fg: "#a52222" },
  neutral: { bg: "#eef1f4", fg: "#50606f" },
};

export type DetailRow = { label: string; value: string };
export type LineItem = { quantity: number; title: string; amount: string };
export type TotalRow = { label: string; value: string; strong?: boolean };
export type Step = { label: string; done: boolean; current?: boolean };
export type Action = { label: string; url: string };

export type EmailDoc = {
  /** Linha de pré-visualização que o cliente de email mostra a seguir ao assunto. */
  preheader?: string;
  /**
   * Caracter do emblema. Texto, não imagem: tem de aparecer com as imagens bloqueadas, e
   * por isso só os de `SAFE_SYMBOLS`, que têm glifo nos tipos de letra de sistema.
   */
  symbol?: SafeSymbol;
  tone?: Tone;
  /** Ilustração própria, quando existir. O emblema fica como recuo se não carregar. */
  heroImageUrl?: string;
  heroAlt?: string;
  title: string;
  subtitle?: string;
  lead?: string[];
  detailsTitle?: string;
  details?: DetailRow[];
  items?: LineItem[];
  totals?: TotalRow[];
  stepsTitle?: string;
  steps?: Step[];
  cta?: Action;
  secondaryCta?: Action;
  notes?: string[];
  /** Porque é que esta mensagem foi enviada. Obrigatório: vai no rodapé de todas. */
  reason: string;
  /**
   * Endereço para deixar de receber mensagens desta loja. Só nas de marketing: pôr um
   * destes numa confirmação de encomenda convida a cancelar o que não se pode cancelar.
   */
  unsubscribeUrl?: string;
};

/**
 * Valores em kwanzas: `13.000,00 Kz`.
 *
 * Escrito à mão de propósito. O `toLocaleString("pt-AO")` devolve o separador de milhares
 * que o ICU daquele runtime tiver — no Node dá espaço fino (`13 000,00`), e num runtime sem
 * dados de localização cai no formato inglês (`13,000.00`). Um email com o total de uma
 * compra não pode mudar de formato com a máquina que o gerou.
 */
export function formatKz(amount: unknown): string {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const [whole, cents] = Math.abs(safe).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped},${cents} Kz`;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Só `https:` e `mailto:` em atributos de endereço: fecha a porta a `javascript:`. */
function safeUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https:\/\//i.test(raw) || /^mailto:/i.test(raw)) return raw;
  return "";
}

/** Converte o que o painel tem configurado na identidade usada por todos os emails. */
export function brandFromSettings(settings: Record<string, any> | null, siteUrl = ""): Brand {
  const s = settings || {};
  return {
    siteName: String(s.site_name || "Livraria Adventista"),
    logoUrl: safeUrl(s.logo_url),
    color: /^#[0-9a-f]{6}$/i.test(String(s.primary_color || "")) ? String(s.primary_color) : BRAND_FALLBACK_COLOR,
    siteUrl: safeUrl(siteUrl || s.site_url),
    contactEmail: String(s.contact_email || ""),
    contactPhone: String(s.contact_phone || ""),
    contactAddress: String(s.contact_address || ""),
  };
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

function header(brand: Brand): string {
  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" width="140" alt="${esc(brand.siteName)}" style="display:block;border:0;max-width:140px;height:auto">`
    : `<span style="font:600 19px/1.3 ${FONT};color:${PAPER}">${esc(brand.siteName)}</span>`;
  const wrapped = brand.siteUrl ? `<a href="${esc(brand.siteUrl)}" style="text-decoration:none">${logo}</a>` : logo;
  return `<tr><td style="background:${brand.color};padding:22px 28px" align="left">${wrapped}</td></tr>`;
}

function badge(doc: EmailDoc): string {
  if (!doc.symbol && !doc.heroImageUrl) return "";
  const tone = TONES[doc.tone || "brand"];
  const hero = safeUrl(doc.heroImageUrl);
  if (hero) {
    // Com imagem: o `alt` carrega o significado quando o cliente a bloqueia.
    return `<tr><td align="center" style="padding:28px 28px 0">
      <img src="${esc(hero)}" width="132" alt="${esc(doc.heroAlt || doc.title)}" style="display:block;border:0;max-width:132px;height:auto">
    </td></tr>`;
  }
  return `<tr><td align="center" style="padding:28px 28px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;background:${tone.bg};border-radius:32px;font:400 30px/1 ${FONT};color:${tone.fg}">${esc(doc.symbol)}</td>
    </tr></table>
  </td></tr>`;
}

function heading(doc: EmailDoc): string {
  const sub = doc.subtitle
    ? `<p style="margin:8px 0 0;font:400 15px/1.55 ${FONT};color:${INK_SOFT}">${esc(doc.subtitle)}</p>`
    : "";
  return `<tr><td align="center" style="padding:20px 28px 0">
    <h1 style="margin:0;font:600 23px/1.3 ${FONT};color:${INK}">${esc(doc.title)}</h1>${sub}
  </td></tr>`;
}

function paragraphs(lines: string[] = []): string {
  if (!lines.length) return "";
  const body = lines
    .map((l) => `<p style="margin:0 0 12px;font:400 15px/1.65 ${FONT};color:${INK}">${esc(l)}</p>`)
    .join("");
  return `<tr><td style="padding:22px 28px 0">${body}</td></tr>`;
}

function detailsBlock(doc: EmailDoc): string {
  if (!doc.details?.length) return "";
  const title = doc.detailsTitle
    ? `<tr><td colspan="2" style="padding:0 0 10px;font:600 12px/1.4 ${FONT};color:${INK_SOFT};letter-spacing:.06em;text-transform:uppercase">${esc(doc.detailsTitle)}</td></tr>`
    : "";
  const rows = doc.details
    .map(
      (d) => `<tr>
        <td style="padding:7px 0;font:400 14px/1.5 ${FONT};color:${INK_SOFT}" valign="top">${esc(d.label)}</td>
        <td style="padding:7px 0;font:600 14px/1.5 ${FONT};color:${INK};text-align:right" valign="top">${esc(d.value)}</td>
      </tr>`,
    )
    .join("");
  return `<tr><td style="padding:22px 28px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CANVAS};border:1px solid ${LINE};border-radius:10px">
      <tr><td style="padding:16px 18px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${title}${rows}</table>
      </td></tr>
    </table>
  </td></tr>`;
}

function itemsBlock(doc: EmailDoc): string {
  if (!doc.items?.length && !doc.totals?.length) return "";
  const items = (doc.items || [])
    .map(
      (it) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};font:400 14px/1.5 ${FONT};color:${INK}" valign="top">${esc(it.quantity)}× ${esc(it.title)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};font:400 14px/1.5 ${FONT};color:${INK};text-align:right;white-space:nowrap" valign="top">${esc(it.amount)}</td>
      </tr>`,
    )
    .join("");
  const totals = (doc.totals || [])
    .map((t) => {
      const weight = t.strong ? "600" : "400";
      const size = t.strong ? "16px" : "14px";
      const color = t.strong ? INK : INK_SOFT;
      return `<tr>
        <td style="padding:${t.strong ? "12px" : "6px"} 0 ${t.strong ? "0" : "6px"};font:${weight} ${size}/1.5 ${FONT};color:${color}">${esc(t.label)}</td>
        <td style="padding:${t.strong ? "12px" : "6px"} 0 ${t.strong ? "0" : "6px"};font:${weight} ${size}/1.5 ${FONT};color:${color};text-align:right;white-space:nowrap">${esc(t.value)}</td>
      </tr>`;
    })
    .join("");
  return `<tr><td style="padding:22px 28px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${items}${totals}</table>
  </td></tr>`;
}

function stepsBlock(doc: EmailDoc): string {
  if (!doc.steps?.length) return "";
  const title = doc.stepsTitle
    ? `<p style="margin:0 0 12px;font:600 12px/1.4 ${FONT};color:${INK_SOFT};letter-spacing:.06em;text-transform:uppercase">${esc(doc.stepsTitle)}</p>`
    : "";
  // Uma linha por etapa: num email não há como garantir uma barra horizontal que não
  // parta no telemóvel nem no Outlook, e em lista lê-se igual de bem nos dois.
  const rows = doc.steps
    .map((st) => {
      const mark = st.done ? "✓" : st.current ? "•" : "○";
      const color = st.done ? TONES.success.fg : st.current ? TONES.brand.fg : INK_SOFT;
      const weight = st.current ? "600" : "400";
      return `<tr>
        <td width="24" valign="top" style="width:24px;padding:5px 0;font:600 14px/1.5 ${FONT};color:${color}">${mark}</td>
        <td valign="top" style="padding:5px 0;font:${weight} 14px/1.5 ${FONT};color:${st.done || st.current ? INK : INK_SOFT}">${esc(st.label)}</td>
      </tr>`;
    })
    .join("");
  return `<tr><td style="padding:22px 28px 0">${title}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
  </td></tr>`;
}

function buttons(brand: Brand, doc: EmailDoc): string {
  const primary = doc.cta && safeUrl(doc.cta.url) ? doc.cta : null;
  const secondary = doc.secondaryCta && safeUrl(doc.secondaryCta.url) ? doc.secondaryCta : null;
  if (!primary && !secondary) return "";
  const main = primary
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr>
        <td align="center" style="background:${brand.color};border-radius:8px">
          <a href="${esc(safeUrl(primary.url))}" style="display:inline-block;padding:13px 28px;font:600 15px/1.2 ${FONT};color:${PAPER};text-decoration:none">${esc(primary.label)}</a>
        </td>
      </tr></table>`
    : "";
  const alt = secondary
    ? `<p style="margin:${primary ? "14px" : "0"} 0 0;text-align:center">
        <a href="${esc(safeUrl(secondary.url))}" style="font:500 14px/1.5 ${FONT};color:${brand.color};text-decoration:underline">${esc(secondary.label)}</a>
      </p>`
    : "";
  return `<tr><td align="center" style="padding:26px 28px 0">${main}${alt}</td></tr>`;
}

function notesBlock(notes: string[] = []): string {
  if (!notes.length) return "";
  const body = notes
    .map((n) => `<p style="margin:0 0 8px;font:400 13px/1.6 ${FONT};color:${INK_SOFT}">${esc(n)}</p>`)
    .join("");
  return `<tr><td style="padding:22px 28px 0">${body}</td></tr>`;
}

function footer(brand: Brand, doc: EmailDoc): string {
  const unsubscribe = safeUrl(doc.unsubscribeUrl);
  const bits: string[] = [];
  if (brand.contactAddress) bits.push(esc(brand.contactAddress));
  if (brand.contactPhone) bits.push(esc(brand.contactPhone));
  if (brand.contactEmail) {
    bits.push(`<a href="mailto:${esc(brand.contactEmail)}" style="color:${INK_SOFT};text-decoration:underline">${esc(brand.contactEmail)}</a>`);
  }
  if (brand.siteUrl) {
    const label = brand.siteUrl.replace(/^https:\/\//, "").replace(/\/$/, "");
    bits.push(`<a href="${esc(brand.siteUrl)}" style="color:${INK_SOFT};text-decoration:underline">${esc(label)}</a>`);
  }
  return `<tr><td style="padding:30px 28px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="border-top:1px solid ${LINE};padding-top:18px">
        <p style="margin:0 0 6px;font:600 13px/1.5 ${FONT};color:${INK}">${esc(brand.siteName)}</p>
        ${bits.length ? `<p style="margin:0 0 10px;font:400 12px/1.7 ${FONT};color:${INK_SOFT}">${bits.join(" · ")}</p>` : ""}
        <p style="margin:0;font:400 12px/1.6 ${FONT};color:${INK_SOFT}">${esc(doc.reason)}</p>
        ${unsubscribe ? `<p style="margin:10px 0 0;font:400 12px/1.6 ${FONT};color:${INK_SOFT}"><a href="${esc(unsubscribe)}" style="color:${INK_SOFT};text-decoration:underline">Deixar de receber estas mensagens</a></p>` : ""}
      </td></tr>
    </table>
  </td></tr>`;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

/**
 * Monta uma mensagem a partir do seu conteúdo. Devolve sempre as duas versões: o `html` e o
 * `text`, ambos gerados daqui, para não se desencontrarem.
 */
export function emailDocument(brand: Brand, doc: EmailDoc): { html: string; text: string } {
  const preheader = doc.preheader || doc.subtitle || doc.title;
  const html = `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(doc.title)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CANVAS}">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${PAPER};border-radius:12px;overflow:hidden">
      ${header(brand)}
      ${badge(doc)}
      ${heading(doc)}
      ${paragraphs(doc.lead)}
      ${detailsBlock(doc)}
      ${itemsBlock(doc)}
      ${stepsBlock(doc)}
      ${buttons(brand, doc)}
      ${notesBlock(doc.notes)}
      ${footer(brand, doc)}
    </table>
  </td></tr>
</table>
</body></html>`;

  return { html, text: emailText(brand, doc) };
}

/** A mesma mensagem em texto simples, para quem lê sem HTML e para os filtros de correio. */
export function emailText(brand: Brand, doc: EmailDoc): string {
  const out: string[] = [brand.siteName.toUpperCase(), ""];
  out.push(doc.title);
  if (doc.subtitle) out.push(doc.subtitle);
  out.push("");
  for (const line of doc.lead || []) out.push(line, "");
  if (doc.details?.length) {
    if (doc.detailsTitle) out.push(doc.detailsTitle.toUpperCase());
    for (const d of doc.details) out.push(`${d.label}: ${d.value}`);
    out.push("");
  }
  if (doc.items?.length) {
    for (const it of doc.items) out.push(`${it.quantity}x ${it.title} — ${it.amount}`);
    out.push("");
  }
  if (doc.totals?.length) {
    for (const t of doc.totals) out.push(`${t.label}: ${t.value}`);
    out.push("");
  }
  if (doc.steps?.length) {
    if (doc.stepsTitle) out.push(doc.stepsTitle.toUpperCase());
    for (const st of doc.steps) out.push(`${st.done ? "[x]" : "[ ]"} ${st.label}${st.current ? "  <- agora" : ""}`);
    out.push("");
  }
  if (doc.cta && safeUrl(doc.cta.url)) out.push(`${doc.cta.label}: ${safeUrl(doc.cta.url)}`, "");
  if (doc.secondaryCta && safeUrl(doc.secondaryCta.url)) {
    out.push(`${doc.secondaryCta.label}: ${safeUrl(doc.secondaryCta.url)}`, "");
  }
  for (const n of doc.notes || []) out.push(n, "");
  out.push("--", brand.siteName);
  const contact = [brand.contactAddress, brand.contactPhone, brand.contactEmail, brand.siteUrl].filter(Boolean);
  if (contact.length) out.push(contact.join(" · "));
  out.push(doc.reason);
  const unsubscribe = safeUrl(doc.unsubscribeUrl);
  if (unsubscribe) out.push(`Para deixar de receber estas mensagens: ${unsubscribe}`);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

/**
 * Categorias opcionais, as únicas que a loja pode desligar.
 *
 * O que não está aqui sai sempre: a confirmação da encomenda, o pagamento, a entrega, o
 * cancelamento e tudo o que é conta (convite, recuperação). São a prova de uma compra e o
 * acesso a uma conta. A regra vive aqui, e não só nos interruptores do painel, para que
 * nenhuma configuração — nem um valor estranho guardado à mão — possa calar uma mensagem
 * que o cliente precisa de receber.
 */
export const OPTIONAL_CATEGORIES = {
  welcome: "Boas-vindas a quem cria conta",
  order_progress: "Progresso da encomenda (a preparar, expedida, em trânsito, saiu para entrega)",
  campaign: "Campanhas e novidades",
} as const;

export type OptionalCategory = keyof typeof OPTIONAL_CATEGORIES;

export function isOptionalCategory(value: unknown): value is OptionalCategory {
  return typeof value === "string" && value in OPTIONAL_CATEGORIES;
}

/**
 * Esta categoria está activa?
 *
 * Uma categoria que não seja opcional é sempre `true`. Entre as opcionais, só `false`
 * explícito desliga: uma configuração em falta, nula ou mal formada deixa tudo a funcionar
 * como antes, em vez de calar mensagens por omissão.
 */
export function isCategoryEnabled(settings: Record<string, any> | null, category: string): boolean {
  if (!isOptionalCategory(category)) return true;
  const config = settings?.email_categories;
  if (!config || typeof config !== "object") return true;
  return config[category] !== false;
}

/** Estado de todas as categorias opcionais, para o painel. */
export function categoryStates(settings: Record<string, any> | null) {
  return (Object.keys(OPTIONAL_CATEGORIES) as OptionalCategory[]).map((key) => ({
    key,
    label: OPTIONAL_CATEGORIES[key],
    enabled: isCategoryEnabled(settings, key),
  }));
}

// ---------------------------------------------------------------------------
// Falhas de envio
// ---------------------------------------------------------------------------

/** De onde veio a falha. O mesmo número quer dizer coisas opostas conforme a origem. */
export type FailureSource = "http" | "smtp" | "network";

/**
 * Vale a pena repetir este envio?
 *
 * Repetir só ajuda quando a causa é passageira: o servidor em baixo, um limite de ritmo, a
 * rede. Um endereço inválido ou uma chave recusada respondem sempre o mesmo, e insistir
 * nesses só gasta tentativas — e, no caso de um endereço que não existe, prejudica a
 * reputação do domínio junto dos fornecedores de correio.
 *
 * A origem é passada e não adivinhada, porque o mesmo número significa o oposto conforme
 * vem de um lado ou do outro: **550 em HTTP** é o servidor com um problema, e repete-se;
 * **550 em SMTP** é "essa caixa de correio não existe", e nunca vai mudar.
 */
export function isRetriableFailure(source: FailureSource, status?: number | null, message = ""): boolean {
  const code = Number(status) || 0;
  const text = String(message || "").toLowerCase();

  // Nem chegou a haver resposta: problema de ligação, que costuma passar.
  if (source === "network") return true;

  if (source === "smtp") {
    // 4xx em SMTP é "tente mais tarde"; 5xx é recusa definitiva.
    if (code >= 400 && code < 500) return true;
    if (code >= 500) return false;
    // Sem código legível, decide-se pelo texto: o SMTP escreve o motivo antes do número.
    return !/5\.\d\.\d|mailbox|recipient|does not exist|no such user|rejected|blocked/.test(text);
  }

  // HTTP: o servidor em baixo e o limite de ritmo repetem-se; o resto não.
  if (code === 429 || code === 408) return true;
  if (code >= 500 && code < 600) return true;
  if (code >= 400 && code < 500) return false;
  // Sem código: tratado como falha de ligação.
  return true;
}

/** Espera antes da tentativa seguinte, em segundos: 1 min, 5 min, 15 min, 1 h, 3 h. */
export function retryDelaySeconds(attempts: number): number {
  const ladder = [60, 300, 900, 3600, 10800];
  const index = Math.min(Math.max(attempts - 1, 0), ladder.length - 1);
  return ladder[index];
}

/**
 * Compara dois segredos sem deixar o tempo de resposta dizer quanto do valor estava certo.
 *
 * Um `===` sai no primeiro caracter diferente, e a diferença de tempo entre "errou logo" e
 * "errou no fim" permite descobrir o segredo caracter a caracter. Aqui percorre-se sempre
 * todo o comprimento e só no fim se decide.
 */
export function secretsMatch(a: string, b: string): boolean {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (x.length !== y.length) return false;
  if (x.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
