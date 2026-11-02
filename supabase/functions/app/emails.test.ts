import { describe, expect, it } from "vitest";
import {
  OPTIONAL_CATEGORIES, SAFE_SYMBOLS, brandFromSettings, categoryStates, emailDocument,
  formatKz, isCategoryEnabled, isRetriableFailure, retryDelaySeconds, secretsMatch, type Brand,
} from "./emails.ts";
import {
  accessLinkLetter,
  noticeLetter,
  orderCreatedLetter,
  orderStatusLetter,
  orderSteps,
  passwordChangedLetter,
  paymentConfirmedLetter,
  testLetter,
  welcomeLetter,
  PREVIEW_TEMPLATES,
  unsubscribeUrlFor,
} from "./emailTemplates.ts";

const SETTINGS = {
  site_name: "Livraria Adventista",
  primary_color: "#0ea5c9",
  logo_url: "https://exemplo.ao/logo.png",
  contact_email: "contacto@livraria.ao",
  contact_phone: "+244 923 000 000",
  contact_address: "Luanda, Angola",
};

const brand: Brand = brandFromSettings(SETTINGS, "https://loja.exemplo.ao");

const ORDER = {
  id: "ord_123",
  order_number: "LA-2026-0042",
  customer_name: "Maria da Conceição Fernandes",
  customer_email: "maria@exemplo.ao",
  items: [
    { quantity: 2, title: "O Grande Conflito", price: 4500 },
    { quantity: 1, title: "Caminho a Cristo", price: 2500 },
  ],
  total: 13000,
  shipping_cost: 1500,
  payment_method_name: "Multicaixa Express",
  payment_status: "pending",
  shipping_method: "delivery",
  delivery_address_full: "Rua 1, Maianga, Luanda",
  created: "2026-11-02T09:00:00.000Z",
};

describe("formatKz", () => {
  it("escreve os kwanzas à maneira angolana", () => {
    expect(formatKz(0)).toBe("0,00 Kz");
    expect(formatKz(1500)).toBe("1.500,00 Kz");
    expect(formatKz(13000)).toBe("13.000,00 Kz");
    expect(formatKz(1234567.5)).toBe("1.234.567,50 Kz");
    expect(formatKz(999)).toBe("999,00 Kz");
    expect(formatKz(1000)).toBe("1.000,00 Kz");
  });

  it("não depende da localização do runtime", () => {
    // Era o problema do `toLocaleString("pt-AO")`: no Node dá espaço fino em vez de ponto, e
    // num runtime sem dados de localização cai no formato inglês. O total de uma compra não
    // pode mudar de formato com a máquina que gerou o email.
    expect(formatKz(13000)).not.toContain(" 000");
    expect(formatKz(13000)).not.toContain("13,000");
  });

  it("arredonda aos cêntimos", () => {
    expect(formatKz(10.005)).toBe("10,01 Kz");
    expect(formatKz(10.004)).toBe("10,00 Kz");
  });

  it("aguenta valores negativos e lixo", () => {
    expect(formatKz(-2500)).toBe("-2.500,00 Kz");
    expect(formatKz(null)).toBe("0,00 Kz");
    expect(formatKz(undefined)).toBe("0,00 Kz");
    expect(formatKz("abc")).toBe("0,00 Kz");
    expect(formatKz(Infinity)).toBe("0,00 Kz");
  });
});

describe("brandFromSettings", () => {
  it("usa o que está configurado no painel", () => {
    expect(brand.siteName).toBe("Livraria Adventista");
    expect(brand.color).toBe("#0ea5c9");
    expect(brand.siteUrl).toBe("https://loja.exemplo.ao");
    expect(brand.contactEmail).toBe("contacto@livraria.ao");
  });

  it("tem valores de recurso sem configurações", () => {
    const b = brandFromSettings(null);
    expect(b.siteName).toBe("Livraria Adventista");
    expect(b.color).toBe("#0ea5c9");
    expect(b.logoUrl).toBe("");
  });

  it("recusa uma cor que não seja hexadecimal", () => {
    // Sem isto, um valor qualquer nas configurações entrava no `style=` dos emails.
    const b = brandFromSettings({ ...SETTINGS, primary_color: "red; background:url(x)" });
    expect(b.color).toBe("#0ea5c9");
  });

  it("recusa logótipos e endereços que não sejam https", () => {
    const b = brandFromSettings({ ...SETTINGS, logo_url: "javascript:alert(1)" }, "http://inseguro.ao");
    expect(b.logoUrl).toBe("");
    expect(b.siteUrl).toBe("");
  });
});

describe("emailDocument", () => {
  const letter = orderCreatedLetter(brand, ORDER, "https://pagamento.exemplo.ao/abc");
  const { html, text } = emailDocument(brand, letter.doc);

  it("gera um documento HTML completo", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="pt">');
    expect(html).toContain('<meta name="viewport"');
  });

  it("monta a moldura com cabeçalho, logótipo e rodapé institucional", () => {
    expect(html).toContain("https://exemplo.ao/logo.png");
    expect(html).toContain("Luanda, Angola");
    expect(html).toContain("+244 923 000 000");
    expect(html).toContain("contacto@livraria.ao");
    // Todas as mensagens dizem porque foram enviadas.
    expect(html).toContain("Recebeu esta mensagem porque fez uma encomenda nesta loja.");
    expect(text).toContain("Recebeu esta mensagem porque fez uma encomenda nesta loja.");
  });

  it("usa tabelas e CSS em linha, que é o que os clientes de email mostram", () => {
    expect(html).toContain('<table role="presentation"');
    expect(html).toContain('cellpadding="0"');
    // O Gmail descarta `<style>`; o Outlook não faz flex nem grid.
    expect(html).not.toContain("<style");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display:grid");
  });

  it("não leva nada que os clientes de email bloqueiam", () => {
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("@keyframes");
    expect(html).not.toContain("onclick");
  });

  it("lê-se sem imagens: o emblema e os dados são texto", () => {
    // Sem a ilustração carregada, a mensagem continua completa — a única imagem é o logótipo.
    const semImagens = html.replace(/<img[^>]*>/g, "");
    expect(semImagens).toContain("LA-2026-0042");
    expect(semImagens).toContain("O Grande Conflito");
    expect(semImagens).toContain("13.000,00 Kz");
  });

  it("usa a ilustração quando existir, com texto alternativo", () => {
    const comHero = emailDocument(brand, {
      ...letter.doc,
      heroImageUrl: "https://exemplo.ao/caixa-3d.webp",
      heroAlt: "Caixa de livros",
    });
    expect(comHero.html).toContain("https://exemplo.ao/caixa-3d.webp");
    expect(comHero.html).toContain('alt="Caixa de livros"');
  });

  it("recusa ilustrações e botões que não sejam https", () => {
    const perigoso = emailDocument(brand, {
      ...letter.doc,
      heroImageUrl: "javascript:alert(1)",
      cta: { label: "Clique", url: "javascript:alert(1)" },
    });
    expect(perigoso.html).not.toContain("javascript:");
    expect(perigoso.text).not.toContain("javascript:");
  });

  it("escapa o conteúdo em HTML e em texto", () => {
    const doc = {
      title: 'Olá <script>alert("x")</script>',
      lead: ["Livro & companhia <b>negrito</b>"],
      reason: "Motivo",
    };
    const out = emailDocument(brand, doc);
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).toContain("Livro &amp; companhia");
    // No texto simples não há escape de HTML: as etiquetas aparecem como foram escritas.
    expect(out.text).toContain('Olá <script>alert("x")</script>');
  });

  it("gera a versão em texto com a mesma informação", () => {
    expect(text).toContain("LIVRARIA ADVENTISTA");
    expect(text).toContain("LA-2026-0042");
    expect(text).toContain("2x O Grande Conflito");
    expect(text).toContain("13.000,00 Kz");
    expect(text).toContain("https://pagamento.exemplo.ao/abc");
    expect(text).not.toContain("<table");
    expect(text).not.toContain("style=");
  });

  it("inclui a linha de pré-visualização escondida", () => {
    expect(html).toContain("display:none;max-height:0");
  });
});

describe("orderCreatedLetter", () => {
  it("pede o pagamento quando ainda falta", () => {
    const l = orderCreatedLetter(brand, ORDER, "https://pagamento.exemplo.ao/abc");
    expect(l.subject).toBe("Encomenda LA-2026-0042 recebida");
    expect(l.doc.title).toBe("Recebemos a sua encomenda");
    expect(l.doc.cta?.url).toBe("https://pagamento.exemplo.ao/abc");
    // O segundo botão leva ao rastreio, para quem já pagou por outro meio.
    expect(l.doc.secondaryCta?.url).toContain("/track");
  });

  it("confirma quando a encomenda já está paga", () => {
    const l = orderCreatedLetter(brand, { ...ORDER, payment_status: "paid" });
    // O assunto tem de dizer o mesmo que o título: antes dizia "recebida" nos dois casos.
    expect(l.subject).toBe("Encomenda LA-2026-0042 confirmada");
    expect(l.doc.title).toBe("Encomenda confirmada!");
    expect(l.doc.tone).toBe("success");
    // Já pago: não aparece botão de pagamento.
    expect(l.doc.cta?.url).toContain("/track");
  });

  it("mostra os totais com o envio e o total a destacado", () => {
    const l = orderCreatedLetter(brand, ORDER);
    expect(l.doc.totals).toEqual([
      { label: "Envio", value: "1.500,00 Kz" },
      { label: "Total", value: "13.000,00 Kz", strong: true },
    ]);
  });

  it("diz Grátis quando não há custo de envio", () => {
    const l = orderCreatedLetter(brand, { ...ORDER, shipping_cost: 0 });
    expect(l.doc.totals?.[0]).toEqual({ label: "Envio", value: "Grátis" });
  });

  it("trata o levantamento na loja como tal", () => {
    const l = orderCreatedLetter(brand, { ...ORDER, shipping_method: "pickup", pickup_store: "Loja do Huambo" });
    expect(l.doc.totals?.[0].label).toBe("Levantamento na loja");
    expect(l.doc.details?.some((d) => d.value === "Loja do Huambo")).toBe(true);
    // A quem vai buscar o livro ao balcão não se fala de endereço de entrega.
    expect(l.doc.details?.some((d) => d.label === "Entrega")).toBe(false);
  });

  it("trata o nome do cliente pelo primeiro nome", () => {
    const l = orderCreatedLetter(brand, ORDER);
    expect(l.doc.lead?.[0]).toContain("Olá, Maria!");
  });

  it("não deixa a saudação pendurada sem nome", () => {
    const l = orderCreatedLetter(brand, { ...ORDER, customer_name: "" });
    expect(l.doc.lead?.[0]).toContain("Olá!");
    expect(l.doc.lead?.[0]).not.toContain("Olá,");
  });
});

describe("orderSteps", () => {
  it("marca o que já passou e onde está agora", () => {
    const steps = orderSteps(ORDER, "in_transit");
    const feitas = steps.filter((s) => s.done).map((s) => s.label);
    expect(feitas).toEqual(["Encomenda recebida", "Pagamento confirmado", "A preparar", "Expedida"]);
    expect(steps.find((s) => s.current)?.label).toBe("Em trânsito");
  });

  it("usa a sequência do levantamento na loja", () => {
    const steps = orderSteps({ ...ORDER, shipping_method: "pickup" }, "shipped");
    expect(steps.map((s) => s.label)).toEqual([
      "Encomenda recebida",
      "Pagamento confirmado",
      "A preparar na loja",
      "Pronta para levantamento",
      "Entregue",
    ]);
    // Nada de "em trânsito" nem "saiu para entrega" para quem levanta ao balcão.
    expect(steps.find((s) => s.current)?.label).toBe("Pronta para levantamento");
  });

  it("não marca nada como feito num estado fora da sequência", () => {
    // Mostrar etapas concluídas a seguir a um cancelamento dizia ao cliente o contrário do que é.
    const steps = orderSteps(ORDER, "cancelled");
    expect(steps.some((s) => s.done)).toBe(false);
    expect(steps.some((s) => s.current)).toBe(false);
  });
});

describe("orderStatusLetter", () => {
  it("escreve uma mensagem por cada estado que interessa ao cliente", () => {
    for (const status of ["confirmed", "preparing", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"]) {
      const l = orderStatusLetter(brand, ORDER, status);
      expect(l, status).not.toBeNull();
      expect(l!.subject).toContain("LA-2026-0042");
      expect(l!.doc.title.length).toBeGreaterThan(0);
    }
  });

  it("não escreve nada para um estado sem mensagem", () => {
    // `received` já foi dito pela confirmação da encomenda: repeti-lo era um email a mais.
    expect(orderStatusLetter(brand, ORDER, "received")).toBeNull();
    expect(orderStatusLetter(brand, ORDER, "estado_inventado")).toBeNull();
  });

  it("adapta a expedição ao levantamento na loja", () => {
    const l = orderStatusLetter(brand, { ...ORDER, shipping_method: "pickup" }, "shipped");
    expect(l!.doc.title).toBe("Pronta para levantamento");
    expect(l!.doc.subtitle).toContain("passar pela loja");
  });

  it("mostra rastreio e transportadora só nas entregas ao domicílio", () => {
    const comRastreio = { ...ORDER, tracking_number: "AO123456", carrier: "Expresso" };
    const entrega = orderStatusLetter(brand, comRastreio, "in_transit");
    expect(entrega!.doc.details?.some((d) => d.value === "AO123456")).toBe(true);
    expect(entrega!.doc.details?.some((d) => d.value === "Expresso")).toBe(true);

    const levantamento = orderStatusLetter(brand, { ...comRastreio, shipping_method: "pickup" }, "shipped");
    expect(levantamento!.doc.details?.some((d) => d.value === "AO123456")).toBe(false);
  });

  it("não mostra linha de progresso num cancelamento", () => {
    const l = orderStatusLetter(brand, ORDER, "cancelled");
    expect(l!.doc.steps).toBeUndefined();
    expect(l!.doc.tone).toBe("danger");
  });

  it("inclui a descrição do acontecimento quando o painel a escreve", () => {
    const l = orderStatusLetter(brand, ORDER, "in_transit", { description: "Saiu do armazém de Luanda." });
    expect(l!.doc.lead).toContain("Saiu do armazém de Luanda.");
  });
});

describe("paymentConfirmedLetter", () => {
  it("confirma o pagamento e mostra o total pago", () => {
    const l = paymentConfirmedLetter(brand, { ...ORDER, payment_status: "paid" });
    expect(l.subject).toBe("Pagamento confirmado — LA-2026-0042");
    expect(l.doc.tone).toBe("success");
    expect(l.doc.details?.some((d) => d.label === "Total pago" && d.value === "13.000,00 Kz")).toBe(true);
  });
});

describe("accessLinkLetter", () => {
  it("convida quem ainda não tem palavra-passe", () => {
    const l = accessLinkLetter(brand, "João Silva", "invite", "https://loja.exemplo.ao/reset?t=1");
    expect(l.subject).toContain("A sua conta");
    expect(l.doc.cta?.url).toBe("https://loja.exemplo.ao/reset?t=1");
  });

  it("avisa quem não pediu a recuperação", () => {
    const l = accessLinkLetter(brand, "João", "reset", "https://loja.exemplo.ao/reset?t=1");
    expect(l.doc.lead?.join(" ")).toContain("Se não foi você");
  });

  it("nunca leva palavras-passe, só o link", () => {
    const l = accessLinkLetter(brand, "João", "reset", "https://loja.exemplo.ao/reset?t=1");
    const { html, text } = emailDocument(brand, l.doc);
    expect(l.doc.notes?.join(" ")).toContain("Nunca lhe pedimos a palavra-passe");
    // Só um endereço aparece na mensagem, e é o do link de recuperação.
    expect(html.match(/https:\/\/loja\.exemplo\.ao\/reset/g)?.length).toBe(1);
    expect(text).toContain("expira dentro de uma hora");
  });
});

describe("welcomeLetter e testLetter", () => {
  it("dá as boas-vindas pelo primeiro nome", () => {
    const l = welcomeLetter(brand, "Ana Paula Gomes");
    expect(l.doc.title).toBe("Bem-vindo, Ana!");
    expect(l.doc.reason).toContain("criou uma conta");
  });

  it("funciona sem nome", () => {
    expect(welcomeLetter(brand, "").doc.title).toBe("Bem-vindo, leitor!");
  });

  it("o teste lembra a autenticação do domínio", () => {
    const l = testLetter(brand);
    expect(l.doc.lead?.join(" ")).toContain("SPF, DKIM e DMARC");
  });
});

describe("noticeLetter", () => {
  it("separa marketing de transaccional no rodapé", () => {
    const transaccional = noticeLetter(brand, "Aviso", "Corpo da mensagem.");
    expect(transaccional.doc.reason).toContain("é cliente desta loja");

    // As de marketing dizem que houve consentimento; como sair é o link de cancelamento,
    // que substituiu o "responda com sair" de antes.
    const campanha = noticeLetter(brand, "Novidades", "Corpo.", true, "https://loja.exemplo.ao/unsubscribe?t=x");
    expect(campanha.doc.reason).toContain("aceitou receber novidades");
    expect(campanha.doc.unsubscribeUrl).toBe("https://loja.exemplo.ao/unsubscribe?t=x");
  });

  it("parte o corpo em parágrafos", () => {
    const l = noticeLetter(brand, "Aviso", "Primeiro parágrafo.\n\nSegundo parágrafo.");
    expect(l.doc.lead).toEqual(["Primeiro parágrafo.", "Segundo parágrafo."]);
  });
});

describe("acentuação e moeda", () => {
  it("mantém os caracteres portugueses em HTML e em texto", () => {
    const l = orderCreatedLetter(brand, {
      ...ORDER,
      customer_name: "João Gonçalves",
      items: [{ quantity: 1, title: "Educação e Instrução", price: 3000 }],
    });
    const { html, text } = emailDocument(brand, l.doc);
    expect(html).toContain("Educação e Instrução");
    expect(html).toContain('charset="utf-8"');
    expect(text).toContain("Educação e Instrução");
    expect(l.doc.lead?.[0]).toContain("João");
  });

  it("formata os valores em kwanzas à maneira angolana", () => {
    const l = orderCreatedLetter(brand, { ...ORDER, total: 1234567.5 });
    expect(l.doc.totals?.[1].value).toBe("1.234.567,50 Kz");
  });
});

describe("emblemas", () => {
  // Todos os modelos, para o teste seguinte varrer um a um.
  const todos = [
    welcomeLetter(brand, "Ana"),
    accessLinkLetter(brand, "João", "invite", "https://loja.exemplo.ao/x"),
    accessLinkLetter(brand, "João", "reset", "https://loja.exemplo.ao/x"),
    passwordChangedLetter(brand, "João"),
    orderCreatedLetter(brand, ORDER),
    paymentConfirmedLetter(brand, ORDER),
    ...["confirmed", "preparing", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"]
      .map((st) => orderStatusLetter(brand, ORDER, st)!),
    noticeLetter(brand, "Aviso", "Corpo."),
    testLetter(brand),
  ];

  it("usa só símbolos que os tipos de letra de sistema desenham", () => {
    // A primeira versão usava `⚿` (U+26BF) na recuperação de palavra-passe, e saía um bloco
    // de riscas em vez de uma chave: o caracter não tem glifo em Arial, Helvetica nem Segoe UI.
    for (const letter of todos) {
      if (!letter.doc.symbol) continue;
      expect(SAFE_SYMBOLS, `${letter.subject}: símbolo ${letter.doc.symbol}`)
        .toContain(letter.doc.symbol);
    }
  });

  it("todas as mensagens dizem porque foram enviadas", () => {
    for (const letter of todos) {
      expect(letter.doc.reason, letter.subject).toBeTruthy();
      expect(letter.subject.length, letter.subject).toBeGreaterThan(0);
      // Um assunto longo é cortado pelo cliente de email, e em alguns conta como spam.
      expect(letter.subject.length, letter.subject).toBeLessThanOrEqual(78);
    }
  });

  it("todas geram HTML e texto simples válidos", () => {
    for (const letter of todos) {
      const { html, text } = emailDocument(brand, letter.doc);
      expect(html.startsWith("<!doctype html>"), letter.subject).toBe(true);
      expect(text.length, letter.subject).toBeGreaterThan(50);
      expect(html, letter.subject).toContain(letter.doc.title.slice(0, 10));
    }
  });
});

describe("PREVIEW_TEMPLATES", () => {
  const chaves = Object.keys(PREVIEW_TEMPLATES);

  it("cobre as três áreas de mensagens", () => {
    const grupos = new Set(Object.values(PREVIEW_TEMPLATES).map((t) => t.group));
    expect(grupos).toContain("Conta");
    expect(grupos).toContain("Encomenda");
    expect(grupos).toContain("Entrega");
    expect(chaves.length).toBeGreaterThanOrEqual(15);
  });

  it("todos constroem uma mensagem completa", () => {
    // Vários usam `orderStatusLetter(...)!`, que devolve `null` num estado sem texto: uma
    // chave errada no catálogo rebentaria a pré-visualização só quando alguém a abrisse.
    for (const key of chaves) {
      const letter = PREVIEW_TEMPLATES[key].build(brand);
      expect(letter, key).toBeTruthy();
      expect(letter.subject, key).toBeTruthy();
      expect(letter.doc.title, key).toBeTruthy();
      expect(letter.doc.reason, key).toBeTruthy();
      const { html, text } = emailDocument(brand, letter.doc);
      expect(html.startsWith("<!doctype html>"), key).toBe(true);
      expect(text.length, key).toBeGreaterThan(50);
    }
  });

  it("não leva dados de clientes reais nos exemplos", () => {
    for (const key of chaves) {
      const { html } = emailDocument(brand, PREVIEW_TEMPLATES[key].build(brand));
      // Os endereços de exemplo são todos `exemplo.ao`: um domínio a sério aqui seria um
      // email de teste a sair para alguém.
      const emails = html.match(/[\w.+-]+@[\w.-]+\.\w+/g) || [];
      for (const addr of emails) {
        expect(addr.endsWith("exemplo.ao") || addr === brand.contactEmail, `${key}: ${addr}`).toBe(true);
      }
    }
  });

  it("tem rótulos únicos, para a lista do painel não confundir", () => {
    const labels = Object.values(PREVIEW_TEMPLATES).map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("categorias", () => {
  it("as transaccionais não se desligam", () => {
    // A regra vive no código e não só nos interruptores do painel: uma configuração
    // estranha guardada à mão não pode calar a prova de uma compra nem o acesso à conta.
    const tudoDesligado = { email_categories: { order: false, payment: false, account: false, order_final: false } };
    for (const categoria of ["order", "payment", "account", "order_status", "receipt", ""]) {
      expect(isCategoryEnabled(tudoDesligado, categoria), categoria).toBe(true);
    }
  });

  it("desliga as opcionais quando a configuração o diz", () => {
    const settings = { email_categories: { welcome: false, order_progress: true, campaign: false } };
    expect(isCategoryEnabled(settings, "welcome")).toBe(false);
    expect(isCategoryEnabled(settings, "campaign")).toBe(false);
    expect(isCategoryEnabled(settings, "order_progress")).toBe(true);
  });

  it("sem configuração, tudo continua a sair", () => {
    // Uma configuração em falta não pode calar mensagens por omissão.
    for (const settings of [null, {}, { email_categories: null }, { email_categories: "lixo" }]) {
      expect(isCategoryEnabled(settings as never, "welcome")).toBe(true);
      expect(isCategoryEnabled(settings as never, "campaign")).toBe(true);
    }
  });

  it("só `false` explícito desliga", () => {
    for (const valor of [true, undefined, null, 0, "", "nao"]) {
      expect(isCategoryEnabled({ email_categories: { welcome: valor } }, "welcome"), String(valor)).toBe(true);
    }
  });

  it("o painel recebe as três opcionais com rótulo", () => {
    const estados = categoryStates({ email_categories: { campaign: false } });
    expect(estados.map((c) => c.key)).toEqual(Object.keys(OPTIONAL_CATEGORIES));
    expect(estados.every((c) => c.label.length > 0)).toBe(true);
    expect(estados.find((c) => c.key === "campaign")?.enabled).toBe(false);
    expect(estados.find((c) => c.key === "welcome")?.enabled).toBe(true);
  });
});

describe("cancelamento de subscrição", () => {
  const token = "a".repeat(64);

  it("monta o endereço com o token", () => {
    expect(unsubscribeUrlFor(brand, token)).toBe(`https://loja.exemplo.ao/unsubscribe?t=${token}`);
  });

  it("não inventa um endereço sem o que precisa", () => {
    expect(unsubscribeUrlFor(brand, "")).toBe("");
    expect(unsubscribeUrlFor(brandFromSettings(SETTINGS), token)).toBe("");
  });

  it("o link vai nas campanhas, em HTML e em texto", () => {
    const url = unsubscribeUrlFor(brand, token);
    const { html, text } = emailDocument(brand, noticeLetter(brand, "Novidades", "Corpo.", true, url).doc);
    expect(html).toContain(url);
    expect(html).toContain("Deixar de receber estas mensagens");
    expect(text).toContain(url);
  });

  it("não vai nas transaccionais", () => {
    // Um link de cancelamento numa confirmação de encomenda convida a cancelar o que não se
    // pode cancelar, e ensina o cliente a ignorá-lo onde ele conta.
    const url = unsubscribeUrlFor(brand, token);
    for (const letter of [
      orderCreatedLetter(brand, ORDER),
      paymentConfirmedLetter(brand, ORDER),
      orderStatusLetter(brand, ORDER, "delivered")!,
      accessLinkLetter(brand, "João", "reset", "https://loja.exemplo.ao/x"),
      welcomeLetter(brand, "Ana"),
      // Mesmo passando um endereço, um aviso que não é de marketing não o leva.
      noticeLetter(brand, "Aviso", "Corpo.", false, url),
    ]) {
      expect(letter.doc.unsubscribeUrl, letter.subject).toBeFalsy();
      const { html } = emailDocument(brand, letter.doc);
      expect(html, letter.subject).not.toContain("Deixar de receber");
    }
  });

  it("recusa um endereço de cancelamento inseguro", () => {
    const { html } = emailDocument(brand, {
      title: "Campanha", reason: "Motivo", unsubscribeUrl: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Deixar de receber");
  });
});

describe("isRetriableFailure", () => {
  it("repete quando nem houve resposta", () => {
    // Falha de ligação: a causa é a rede, e costuma passar.
    expect(isRetriableFailure("network")).toBe(true);
    expect(isRetriableFailure("network", null, "fetch failed")).toBe(true);
  });

  describe("HTTP", () => {
    it("repete o servidor em baixo e o limite de ritmo", () => {
      for (const code of [429, 408, 500, 502, 503, 504]) {
        expect(isRetriableFailure("http", code), String(code)).toBe(true);
      }
    });

    it("não repete pedido inválido nem autenticação recusada", () => {
      // A chave errada ou o corpo mal formado respondem sempre o mesmo.
      for (const code of [400, 401, 403, 404, 413, 422]) {
        expect(isRetriableFailure("http", code), String(code)).toBe(false);
      }
    });
  });

  describe("SMTP", () => {
    it("repete os 4xx, que são \"tente mais tarde\"", () => {
      for (const code of [421, 450, 451, 452]) {
        expect(isRetriableFailure("smtp", code), String(code)).toBe(true);
      }
    });

    it("não repete os 5xx, que são recusa definitiva", () => {
      // 550 em SMTP é "essa caixa de correio não existe" — ao contrário de 550 em HTTP, que
      // seria o servidor com um problema. É por isso que a origem é passada e não adivinhada.
      for (const code of [550, 551, 552, 553, 554]) {
        expect(isRetriableFailure("smtp", code), String(code)).toBe(false);
      }
      expect(isRetriableFailure("http", 550)).toBe(true);
    });

    it("sem código, decide pelo texto do servidor", () => {
      for (const texto of [
        "550 5.1.1 User unknown",
        "Mailbox does not exist",
        "Recipient rejected",
        "blocked by policy",
      ]) {
        expect(isRetriableFailure("smtp", null, texto), texto).toBe(false);
      }
      expect(isRetriableFailure("smtp", null, "connection timed out")).toBe(true);
    });
  });
});

describe("retryDelaySeconds", () => {
  it("espera cada vez mais entre tentativas", () => {
    const esperas = [1, 2, 3, 4, 5].map(retryDelaySeconds);
    expect(esperas).toEqual([60, 300, 900, 3600, 10800]);
    // Sempre a crescer: insistir ao mesmo ritmo num servidor em dificuldades piora-o.
    for (let i = 1; i < esperas.length; i++) {
      expect(esperas[i]).toBeGreaterThan(esperas[i - 1]);
    }
  });

  it("não cresce para lá do último degrau", () => {
    expect(retryDelaySeconds(6)).toBe(10800);
    expect(retryDelaySeconds(99)).toBe(10800);
  });

  it("aguenta valores fora do esperado", () => {
    expect(retryDelaySeconds(0)).toBe(60);
    expect(retryDelaySeconds(-5)).toBe(60);
  });
});

describe("secretsMatch", () => {
  const token = "f".repeat(64);

  it("aceita o segredo certo", () => {
    expect(secretsMatch(token, token)).toBe(true);
    expect(secretsMatch("abc", "abc")).toBe(true);
  });

  it("recusa tudo o resto", () => {
    expect(secretsMatch(token, "g".repeat(64))).toBe(false);
    // Difere só no último caracter: o percurso é sempre completo, por isso o tempo de
    // resposta não diz quanto do valor estava certo.
    expect(secretsMatch(token, token.slice(0, 63) + "e")).toBe(false);
    // E só no primeiro.
    expect(secretsMatch(token, "e" + token.slice(1))).toBe(false);
    expect(secretsMatch(token, token.slice(0, 63))).toBe(false);
    expect(secretsMatch(token, token + "f")).toBe(false);
  });

  it("recusa o vazio dos dois lados", () => {
    // Sem isto, um pedido sem cabeçalho passava quando o segredo não estivesse definido.
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("", token)).toBe(false);
    expect(secretsMatch(token, "")).toBe(false);
  });

  it("aguenta valores que não são texto", () => {
    expect(secretsMatch(null as never, null as never)).toBe(false);
    expect(secretsMatch(undefined as never, token)).toBe(false);
  });
});
