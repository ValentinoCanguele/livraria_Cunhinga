/**
 * Os emails que a loja envia, um por acontecimento real do sistema.
 *
 * Cada função devolve `{ subject, doc }`; a moldura e as versões HTML/texto vêm do
 * `emails.ts`. Separar assim mantém o conteúdo de cada mensagem legível e garante que todas
 * têm o mesmo cabeçalho, o mesmo rodapé e a mesma linha a dizer porque foi enviada.
 *
 * O catálogo segue o que esta loja tem: livros físicos, com entrega ao domicílio ou
 * levantamento na loja. Não há produtos digitais, licenças nem vendedores no esquema da base
 * de dados, por isso não há aqui modelos para isso — seriam ficheiros que nada chamaria.
 */
import { formatKz, type Brand, type EmailDoc, type SafeSymbol, type Step } from "./emails.ts";

type Row = Record<string, any>;
export type Letter = { subject: string; doc: EmailDoc };

const money = formatKz;

const dateLong = (value: unknown) => {
  const d = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
};

const firstName = (name: unknown) => String(name || "").trim().split(/\s+/)[0] || "";

const orderRef = (order: Row) => String(order.order_number || order.id || "").trim();

const isPickup = (order: Row) => String(order.shipping_method || "") === "pickup";

/** Link de rastreio da encomenda. `/track` pede o número e o email, por isso é seguro. */
const trackUrl = (siteUrl: string) => (siteUrl ? `${siteUrl.replace(/\/$/, "")}/track` : "");
const ordersUrl = (siteUrl: string) => (siteUrl ? `${siteUrl.replace(/\/$/, "")}/profile?tab=orders` : "");

const REASON_ORDER = "Recebeu esta mensagem porque fez uma encomenda nesta loja.";
const REASON_ACCOUNT = "Recebeu esta mensagem por causa de um pedido feito na sua conta.";

function orderItems(order: Row) {
  return (order.items || []).map((it: Row) => ({
    quantity: Number(it.quantity) || 1,
    title: String(it.title || "Livro"),
    amount: money((Number(it.quantity) || 1) * (Number(it.price) || 0)),
  }));
}

function orderTotals(order: Row) {
  const totals = [];
  const shipping = Number(order.shipping_cost) || 0;
  totals.push({ label: isPickup(order) ? "Levantamento na loja" : "Envio", value: shipping ? money(shipping) : "Grátis" });
  totals.push({ label: "Total", value: money(order.total), strong: true });
  return totals;
}

function deliveryDetails(order: Row) {
  const details = [{ label: "Encomenda", value: orderRef(order) }];
  if (order.created) details.push({ label: "Data", value: dateLong(order.created) });
  if (order.payment_method_name || order.payment_method) {
    details.push({ label: "Pagamento", value: String(order.payment_method_name || order.payment_method) });
  }
  if (isPickup(order)) {
    if (order.pickup_store) details.push({ label: "Levantamento", value: String(order.pickup_store) });
  } else if (order.delivery_address_full || order.address) {
    details.push({ label: "Entrega", value: String(order.delivery_address_full || order.address) });
  }
  return details;
}

/**
 * Linha de progresso da encomenda, com a etapa actual assinalada.
 *
 * As etapas são as do `delivery_status` que a loja já usa, e o texto muda quando é
 * levantamento na loja: "Enviada" não diz nada a quem vai buscar o livro ao balcão.
 */
export function orderSteps(order: Row, status: string): Step[] {
  const pickup = isPickup(order);
  const sequence = pickup
    ? [
        { key: "received", label: "Encomenda recebida" },
        { key: "confirmed", label: "Pagamento confirmado" },
        { key: "preparing", label: "A preparar na loja" },
        { key: "shipped", label: "Pronta para levantamento" },
        { key: "delivered", label: "Entregue" },
      ]
    : [
        { key: "received", label: "Encomenda recebida" },
        { key: "confirmed", label: "Pagamento confirmado" },
        { key: "preparing", label: "A preparar" },
        { key: "shipped", label: "Expedida" },
        { key: "in_transit", label: "Em trânsito" },
        { key: "out_for_delivery", label: "Saiu para entrega" },
        { key: "delivered", label: "Entregue" },
      ];
  const index = sequence.findIndex((s) => s.key === status);
  // Um estado fora da sequência (por exemplo `cancelled`) não marca nada como feito: mostrar
  // etapas concluídas a seguir a um cancelamento seria dizer ao cliente o contrário do que é.
  return sequence.map((s, i) => ({
    label: s.label,
    done: index >= 0 && i < index,
    current: index >= 0 && i === index,
  }));
}

// ---------------------------------------------------------------------------
// A. Conta e segurança
// ---------------------------------------------------------------------------

export function welcomeLetter(brand: Brand, name: string): Letter {
  return {
    subject: `Bem-vindo à ${brand.siteName}`,
    doc: {
      symbol: "✦",
      tone: "brand",
      title: `Bem-vindo, ${firstName(name) || "leitor"}!`,
      subtitle: "A sua conta está criada.",
      lead: [
        "A partir de agora pode acompanhar as suas encomendas, guardar livros na lista de desejos e deixar avaliações.",
      ],
      cta: brand.siteUrl ? { label: "Ver o catálogo", url: `${brand.siteUrl.replace(/\/$/, "")}/shop` } : undefined,
      secondaryCta: ordersUrl(brand.siteUrl) ? { label: "A minha conta", url: ordersUrl(brand.siteUrl) } : undefined,
      reason: "Recebeu esta mensagem porque criou uma conta nesta loja.",
    },
  };
}

export function accessLinkLetter(brand: Brand, name: string, kind: "invite" | "reset", link: string): Letter {
  const invite = kind === "invite";
  return {
    subject: invite ? `A sua conta na ${brand.siteName}` : "Recuperar o acesso à sua conta",
    doc: {
      symbol: invite ? "✉" : "↻",
      tone: invite ? "brand" : "warning",
      title: invite ? "A sua conta está pronta" : "Definir uma nova palavra-passe",
      subtitle: invite
        ? "Falta só definir a palavra-passe."
        : "O link abaixo abre o ecrã para escolher uma nova.",
      lead: [
        `Olá${firstName(name) ? `, ${firstName(name)}` : ""}.`,
        invite
          ? "Use o botão para definir a sua palavra-passe e entrar na loja."
          : "Se não foi você que pediu esta mudança, ignore esta mensagem: a palavra-passe actual continua válida.",
      ],
      cta: { label: invite ? "Definir palavra-passe" : "Escolher nova palavra-passe", url: link },
      notes: [
        "Este link é pessoal, serve uma só vez e expira dentro de uma hora.",
        "Nunca lhe pedimos a palavra-passe por email nem por telefone.",
      ],
      reason: REASON_ACCOUNT,
    },
  };
}

export function passwordChangedLetter(brand: Brand, name: string): Letter {
  return {
    subject: "A sua palavra-passe foi alterada",
    doc: {
      symbol: "✓",
      tone: "success",
      title: "Palavra-passe alterada",
      subtitle: "A alteração foi concluída.",
      lead: [
        `Olá${firstName(name) ? `, ${firstName(name)}` : ""}. A palavra-passe da sua conta acabou de ser alterada.`,
        "Se não foi você, recupere o acesso de imediato e avise-nos.",
      ],
      cta: brand.siteUrl ? { label: "Recuperar acesso", url: `${brand.siteUrl.replace(/\/$/, "")}/forgot-password` } : undefined,
      reason: REASON_ACCOUNT,
    },
  };
}

// ---------------------------------------------------------------------------
// B. Encomendas
// ---------------------------------------------------------------------------

export function orderCreatedLetter(brand: Brand, order: Row, paymentLink = ""): Letter {
  const paid = String(order.payment_status) === "paid";
  // O endereço de rastreio já vai num botão; aqui basta dizer o que é preciso para o usar.
  const notes = ["Pode acompanhar a encomenda a qualquer momento com o número acima e o email desta compra."];
  if (paymentLink && !paid) {
    notes.unshift("Se já pagou, ignore o botão de pagamento: confirmamos o pagamento pela referência indicada.");
  }
  return {
    subject: paid ? `Encomenda ${orderRef(order)} confirmada` : `Encomenda ${orderRef(order)} recebida`,
    doc: {
      symbol: "▣",
      tone: paid ? "success" : "brand",
      title: paid ? "Encomenda confirmada!" : "Recebemos a sua encomenda",
      subtitle: paid
        ? "O pagamento está confirmado e vamos preparar os livros."
        : "Falta só o pagamento para a prepararmos.",
      lead: [
        `Olá${firstName(order.customer_name) ? `, ${firstName(order.customer_name)}` : ""}! Obrigado pela sua compra na ${brand.siteName}.`,
      ],
      detailsTitle: "Detalhes da compra",
      details: deliveryDetails(order),
      items: orderItems(order),
      totals: orderTotals(order),
      stepsTitle: "Estado da encomenda",
      steps: orderSteps(order, paid ? "confirmed" : "received"),
      cta: paymentLink && !paid
        ? { label: `Pagar com ${order.payment_method_name || "o método escolhido"}`, url: paymentLink }
        : (trackUrl(brand.siteUrl) ? { label: "Acompanhar a encomenda", url: trackUrl(brand.siteUrl) } : undefined),
      secondaryCta: paymentLink && !paid && trackUrl(brand.siteUrl)
        ? { label: "Acompanhar a encomenda", url: trackUrl(brand.siteUrl) }
        : undefined,
      notes,
      reason: REASON_ORDER,
    },
  };
}

export function paymentConfirmedLetter(brand: Brand, order: Row): Letter {
  return {
    subject: `Pagamento confirmado — ${orderRef(order)}`,
    doc: {
      symbol: "✓",
      tone: "success",
      title: "Pagamento confirmado!",
      subtitle: isPickup(order)
        ? "Vamos preparar os livros para levantamento."
        : "Vamos preparar a sua encomenda para envio.",
      lead: [
        `Olá${firstName(order.customer_name) ? `, ${firstName(order.customer_name)}` : ""}! Recebemos o pagamento da sua encomenda.`,
      ],
      detailsTitle: "Detalhes da compra",
      details: [
        ...deliveryDetails(order),
        { label: "Total pago", value: money(order.total) },
      ],
      stepsTitle: "Estado da encomenda",
      steps: orderSteps(order, "confirmed"),
      cta: trackUrl(brand.siteUrl) ? { label: "Acompanhar a encomenda", url: trackUrl(brand.siteUrl) } : undefined,
      reason: REASON_ORDER,
    },
  };
}

/** Texto de cada mudança de estado da entrega. */
const STATUS_COPY: Record<string, { title: string; subtitle: string; symbol: SafeSymbol; tone: EmailDoc["tone"] }> = {
  confirmed: { title: "Encomenda confirmada", subtitle: "Está na fila de preparação.", symbol: "✓", tone: "success" },
  preparing: { title: "A preparar a sua encomenda", subtitle: "Estamos a separar os livros.", symbol: "◷", tone: "brand" },
  shipped: { title: "Encomenda expedida", subtitle: "Já saiu da nossa loja.", symbol: "➜", tone: "brand" },
  in_transit: { title: "Encomenda em trânsito", subtitle: "Está a caminho do endereço indicado.", symbol: "➜", tone: "brand" },
  out_for_delivery: { title: "Saiu para entrega", subtitle: "Deve chegar hoje.", symbol: "➜", tone: "warning" },
  delivered: { title: "Encomenda entregue", subtitle: "Boas leituras!", symbol: "✓", tone: "success" },
  cancelled: { title: "Encomenda cancelada", subtitle: "A encomenda não vai seguir.", symbol: "✕", tone: "danger" },
};

/** Para levantamento na loja, "expedida" é "pronta para levantamento". */
const PICKUP_COPY: Record<string, { title: string; subtitle: string }> = {
  shipped: { title: "Pronta para levantamento", subtitle: "Já pode passar pela loja." },
  in_transit: { title: "Pronta para levantamento", subtitle: "Já pode passar pela loja." },
  out_for_delivery: { title: "Pronta para levantamento", subtitle: "Já pode passar pela loja." },
};

/** `null` quando o estado não merece email — não há nada de novo para dizer ao cliente. */
export function orderStatusLetter(brand: Brand, order: Row, status: string, event?: Row): Letter | null {
  const base = STATUS_COPY[status];
  if (!base) return null;
  const pickup = isPickup(order);
  const copy = pickup && PICKUP_COPY[status] ? { ...base, ...PICKUP_COPY[status] } : base;

  const details = deliveryDetails(order);
  if (order.tracking_number && !pickup) {
    details.push({ label: "Rastreio", value: String(order.tracking_number) });
  }
  if (order.carrier && !pickup) details.push({ label: "Transportadora", value: String(order.carrier) });
  if (order.estimated_delivery && status !== "delivered" && status !== "cancelled") {
    details.push({ label: "Previsão", value: dateLong(order.estimated_delivery) });
  }

  const lead = [`Olá${firstName(order.customer_name) ? `, ${firstName(order.customer_name)}` : ""}!`];
  if (event?.description) lead.push(String(event.description));
  if (status === "delivered") {
    lead.push("Obrigado pela sua compra. Se quiser, deixe uma avaliação dos livros que recebeu.");
  }
  if (status === "cancelled") {
    lead.push("Se tiver dúvidas sobre o motivo ou sobre a devolução de um valor já pago, responda a esta mensagem.");
  }

  return {
    subject: `${copy.title} — ${orderRef(order)}`,
    doc: {
      symbol: copy.symbol,
      tone: copy.tone,
      title: copy.title,
      subtitle: copy.subtitle,
      lead,
      detailsTitle: "Detalhes da encomenda",
      details,
      stepsTitle: status === "cancelled" ? undefined : "Estado da encomenda",
      steps: status === "cancelled" ? undefined : orderSteps(order, status),
      cta: trackUrl(brand.siteUrl) ? { label: "Ver a encomenda", url: trackUrl(brand.siteUrl) } : undefined,
      reason: REASON_ORDER,
    },
  };
}

// ---------------------------------------------------------------------------
// C. Avisos simples e testes
// ---------------------------------------------------------------------------

/** Mensagens de contacto e campanhas: texto escrito no painel, dentro da moldura da loja. */
export function noticeLetter(brand: Brand, subject: string, body: string, marketing = false): Letter {
  return {
    subject,
    doc: {
      symbol: "✉",
      tone: "neutral",
      title: subject,
      lead: String(body || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      reason: marketing
        ? "Recebeu esta mensagem porque aceitou receber novidades desta loja. Responda com \"sair\" para deixar de as receber."
        : "Recebeu esta mensagem porque é cliente desta loja.",
    },
  };
}

export function testLetter(brand: Brand): Letter {
  return {
    subject: `Teste de email — ${brand.siteName}`,
    doc: {
      symbol: "✓",
      tone: "success",
      title: "O envio de emails está a funcionar",
      subtitle: "Esta é uma mensagem de teste do painel.",
      lead: [
        "Se recebeu este email, as confirmações de encomenda e os avisos de conta saem para os clientes.",
        "Confirme também se a mensagem não foi para o lixo: se foi, falta autenticar o domínio com SPF, DKIM e DMARC.",
      ],
      reason: "Recebeu esta mensagem porque alguém pediu um teste de envio no painel desta loja.",
    },
  };
}
