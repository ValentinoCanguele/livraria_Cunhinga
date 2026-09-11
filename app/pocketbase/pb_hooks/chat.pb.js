/// <reference path="../pb_data/types.d.ts" />

var rateLimitStore = rateLimitStore || {};

function checkRateLimit(bucket, ip, maxPerMinute) {
  const key = bucket + ":" + (ip || "anon");
  const now = Date.now();
  const max = maxPerMinute || 30;
  if (!rateLimitStore[key]) rateLimitStore[key] = [];
  rateLimitStore[key] = rateLimitStore[key].filter(function (t) { return now - t < 60000; });
  if (rateLimitStore[key].length >= max) return false;
  rateLimitStore[key].push(now);
  return true;
}

function requestClientIp(e) {
  try {
    const info = e.requestInfo();
    const headers = info.headers || {};
    const forwarded = headers["X-Forwarded-For"] || headers["x-forwarded-for"] || "";
    if (forwarded) return String(forwarded).split(",")[0].trim();
    return info.clientIP || info.remoteIP || "anon";
  } catch (err) { return "anon"; }
}

function pbFileUrl(app, record, field) {
  const f = record.get(field);
  if (!f) return "";
  const name = Array.isArray(f) ? f[0] : f;
  if (!name) return "";
  try {
    let url = app.files().getUrl(record, name);
    if (!url) return "";
    if (String(url).indexOf("http") === 0) return String(url);
    let base = "";
    try { base = String(app.settings().meta.appURL || "").replace(/\/$/, ""); } catch (err) {}
    if (!base) base = "http://127.0.0.1:8090";
    if (String(url).indexOf("/") === 0) return base + url;
    return base + "/" + url;
  } catch (err) {
    try {
      const col = record.collection();
      const colId = col ? (col.id || col.name) : "stock_books";
      let base = "";
      try { base = String(app.settings().meta.appURL || "").replace(/\/$/, ""); } catch (e2) {}
      if (!base) base = "http://127.0.0.1:8090";
      return base + "/api/files/" + colId + "/" + record.id + "/" + name;
    } catch (e3) { return ""; }
  }
}

function stockBookToChatItem(app, book) {
  const coverFile = pbFileUrl(app, book, "cover_image");
  return {
    id: book.id,
    title: book.get("title") || "",
    author: book.get("author") || "",
    book_code: book.get("book_code") || "",
    price: book.get("price") ? String(Number(book.get("price"))) + " Kz" : "",
    cover: coverFile || book.get("cover") || "",
    genre: book.get("genre") || "",
    stock: Number(book.get("stock")) || 0,
  };
}

routerAdd("GET", "/api/app/chat/config", (e) => {
  function loadSettings() {
    try {
      const list = $app.findRecordsByFilter("site_settings", "id != ''", "-updated", 1, 0);
      if (list && list.length) return list[0];
    } catch (err) {}
    return null;
  }
  function getKeys(settingsRec) {
    let gemini = "";
    let deepseek = "";
    try { gemini = $os.getenv("GEMINI_API_KEY") || ""; } catch (err) {}
    try { deepseek = $os.getenv("DEEPSEEK_API_KEY") || ""; } catch (err) {}
    if (settingsRec) {
      if (!gemini) gemini = settingsRec.get("gemini_api_key") || "";
      if (!deepseek) deepseek = settingsRec.get("deepseek_api_key") || "";
    }
    return { gemini: gemini, deepseek: deepseek };
  }
  try {
    const settings = loadSettings();
    const keys = getKeys(settings);
    const provider = settings ? (settings.get("chat_provider") || "gemini") : "faq";
    const enabled = settings ? (settings.get("chat_enabled") != false) : true;
    let ai = false;
    let activeProvider = "faq";
    if (provider === "gemini" && keys.gemini) { ai = true; activeProvider = "gemini"; }
    else if (provider === "deepseek" && keys.deepseek) { ai = true; activeProvider = "deepseek"; }
    else if (keys.gemini) { ai = true; activeProvider = "gemini"; }
    return e.json(200, {
      enabled: enabled,
      ai: ai,
      provider: activeProvider,
      welcome: settings ? (settings.get("chat_welcome") || "") : "",
    });
  } catch (err) {
    return e.json(200, { enabled: true, ai: false, provider: "faq", welcome: "" });
  }
});

routerAdd("POST", "/api/app/chat", (e) => {
  function loadSettings() {
    try {
      const list = $app.findRecordsByFilter("site_settings", "id != ''", "-updated", 1, 0);
      if (list && list.length) return list[0];
    } catch (err) {}
    return null;
  }
  function getKeys(settingsRec) {
    let gemini = "";
    let deepseek = "";
    try { gemini = $os.getenv("GEMINI_API_KEY") || ""; } catch (err) {}
    try { deepseek = $os.getenv("DEEPSEEK_API_KEY") || ""; } catch (err) {}
    if (settingsRec) {
      if (!gemini) gemini = settingsRec.get("gemini_api_key") || "";
      if (!deepseek) deepseek = settingsRec.get("deepseek_api_key") || "";
    }
    return { gemini: gemini, deepseek: deepseek };
  }
  function searchBooks(query, limit) {
    const lim = limit || 8;
    const q = (query || "").trim().toLowerCase();
    let books = [];
    const seen = {};
    function addResults(list) {
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        if (!seen[list[i].id]) {
          seen[list[i].id] = true;
          books.push(list[i]);
        }
      }
    }
    try {
      if (q.length >= 2) {
        const safe = q.replace(/"/g, "");
        addResults($app.findRecordsByFilter(
          "stock_books",
          "stock > 0 && (title ~ {:q} || author ~ {:q} || genre ~ {:q} || book_code ~ {:q})",
          "-featured,-created", lim, 0,
          { q: safe }
        ));
        if (books.length < lim) {
          addResults($app.findRecordsByFilter(
            "stock_books",
            "stock > 0 && description ~ {:q}",
            "-featured,-created", lim - books.length, 0,
            { q: safe }
          ));
        }
      }
      if (!books.length) {
        addResults($app.findRecordsByFilter("stock_books", "stock > 0 && featured = true", "-created", lim, 0));
      }
      if (!books.length) {
        addResults($app.findRecordsByFilter("stock_books", "stock > 0", "-featured,-created", lim, 0));
      }
    } catch (err) {}
    const out = [];
    for (let i = 0; i < books.length && out.length < lim; i++) {
      out.push(stockBookToChatItem($app, books[i]));
    }
    return out;
  }
  function buildPrompt(settingsRec, books, page) {
    const site = settingsRec ? (settingsRec.get("site_name") || "Livraria Adventista") : "Livraria Adventista";
    const shipping = settingsRec ? Number(settingsRec.get("shipping_free_threshold")) || 20000 : 20000;
    let catalog = "";
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      catalog += "- [" + b.id + "] " + b.title;
      if (b.book_code) catalog += " (" + b.book_code + ")";
      catalog += " | " + b.author + " | " + b.price + " | stock:" + b.stock + "\n";
    }
    return [
      "Assistente da " + site + ". Responde em português de Portugal.",
      "Só recomende livros do catálogo listado. Não invente títulos.",
      "Página: " + (page || "/") + ". Serviços: /shop, /track, /contact, /faq.",
      "Envio grátis acima de " + String(Math.round(shipping)) + " Kz.",
      "Catálogo (IDs reais):\n" + catalog,
      'JSON: {"reply":"","suggestions":[],"links":[{"label":"","path":""}],"product_ids":[]}',
    ].join("\n");
  }
  function parseAiJson(raw) {
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
    } catch (err) {
      return { reply: text.slice(0, 2000), suggestions: [], links: [], product_ids: [] };
    }
  }
  function callGemini(apiKey, model, systemPrompt, history, userMessage) {
    const contents = [];
    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      if (!h.content) continue;
      contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: String(h.content).slice(0, 1200) }] });
    }
    contents.push({ role: "user", parts: [{ text: String(userMessage).slice(0, 1200) }] });
    const mdl = model || "gemini-2.0-flash-lite";
    const res = $http.send({
      url: "https://generativelanguage.googleapis.com/v1beta/models/" + mdl + ":generateContent?key=" + apiKey,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: { temperature: 0.65, maxOutputTokens: 900, responseMimeType: "application/json" },
      }),
      timeout: 45,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    try {
      const body = JSON.parse(res.raw || "{}");
      const parts = body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts;
      return parts && parts[0] ? parts[0].text : null;
    } catch (err) { return null; }
  }
  function callDeepseek(apiKey, model, systemPrompt, history, userMessage) {
    const messages = [{ role: "system", content: systemPrompt }];
    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      if (!h.content) continue;
      messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.content).slice(0, 1200) });
    }
    messages.push({ role: "user", content: String(userMessage).slice(0, 1200) });
    const res = $http.send({
      url: "https://api.deepseek.com/chat/completions",
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: messages,
        temperature: 0.65,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
      timeout: 45,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    try {
      const body = JSON.parse(res.raw || "{}");
      return body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    } catch (err) { return null; }
  }
  function faqFallback(message, settingsRec, books) {
    const q = (message || "").toLowerCase();
    let reply = "";
    if (q.indexOf("envio") >= 0 || q.indexOf("entrega") >= 0) reply = "A entrega padrão demora 5-7 dias úteis em Luanda e 7-14 noutras províncias.";
    else if (q.indexOf("grátis") >= 0 || q.indexOf("gratis") >= 0) reply = "Envio grátis para encomendas acima do limiar configurado na loja.";
    else if (q.indexOf("pagamento") >= 0 || q.indexOf("pagar") >= 0) reply = "Aceitamos transferência, Multicaixa Express e pagamento na entrega.";
    else if (q.indexOf("rastrear") >= 0 || q.indexOf("encomenda") >= 0) reply = "Rastreie em /track com o número e email da compra.";
    else if (q.indexOf("catálogo") >= 0 || q.indexOf("catalogo") >= 0 || q.indexOf("livro") >= 0) {
      if (books.length) {
        reply = "Temos " + books.length + " sugestões no catálogo, por exemplo «" + books[0].title + "». Explore /shop.";
      } else {
        reply = "Explore o catálogo em /shop ou diga-me o tema que procura.";
      }
    }
    else {
      const wa = settingsRec ? (settingsRec.get("whatsapp") || settingsRec.get("contact_phone") || "") : "";
      reply = "Posso ajudar com envios, pagamentos e catálogo. Visite /contact" + (wa ? " ou WhatsApp " + wa : "") + ".";
    }
    const productIds = books.slice(0, 2).map(function (b) { return b.id; });
    return {
      reply: reply,
      suggestions: ["Ver catálogo", "Envio grátis?", "Rastrear encomenda", "Falar com a equipa"],
      links: [{ label: "Loja", path: "/shop" }, { label: "FAQ", path: "/faq" }, { label: "Contacto", path: "/contact" }],
      product_ids: productIds,
    };
  }
  function enrichProducts(productIds, catalogBooks) {
    const map = {};
    for (let i = 0; i < catalogBooks.length; i++) map[catalogBooks[i].id] = catalogBooks[i];
    const out = [];
    for (let j = 0; j < productIds.length; j++) {
      if (map[productIds[j]]) out.push(map[productIds[j]]);
    }
    if (!out.length && catalogBooks.length) out.push(catalogBooks[0]);
    return out.slice(0, 4);
  }
  function trimHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.slice(-8).filter(function (h) {
      return h && (h.role === "user" || h.role === "assistant") && h.content;
    });
  }

  try {
    const ip = requestClientIp(e);
    if (!checkRateLimit("chat", ip, 20)) {
      throw new BadRequestError("Demasiadas mensagens. Aguarde um minuto.");
    }

    const data = e.requestInfo().body;
    const message = (data.message || "").trim();
    const page = (data.page || "/").slice(0, 120);
    const history = trimHistory(data.history);
    if (!message) throw new BadRequestError("Mensagem vazia.");
    if (message.length > 800) throw new BadRequestError("Mensagem demasiado longa.");

    const settings = loadSettings();
    if (settings && settings.get("chat_enabled") === false) {
      throw new BadRequestError("Assistente temporariamente indisponível.");
    }

    const books = searchBooks(message, 8);
    const keys = getKeys(settings);
    const providerPref = settings ? (settings.get("chat_provider") || "gemini") : "faq";
    const model = settings ? (settings.get("chat_model") || "") : "";
    const systemPrompt = buildPrompt(settings, books, page);

    let parsed = null;
    let usedAi = false;
    let activeProvider = "faq";

    if (providerPref !== "faq") {
      if (providerPref === "gemini" && keys.gemini) {
        const rawAi = callGemini(keys.gemini, model || "gemini-2.0-flash-lite", systemPrompt, history, message);
        if (rawAi) { parsed = parseAiJson(rawAi); usedAi = true; activeProvider = "gemini"; }
      } else if (providerPref === "deepseek" && keys.deepseek) {
        const rawAi = callDeepseek(keys.deepseek, model || "deepseek-chat", systemPrompt, history, message);
        if (rawAi) { parsed = parseAiJson(rawAi); usedAi = true; activeProvider = "deepseek"; }
      } else if (keys.gemini) {
        const rawAi = callGemini(keys.gemini, model || "gemini-2.0-flash-lite", systemPrompt, history, message);
        if (rawAi) { parsed = parseAiJson(rawAi); usedAi = true; activeProvider = "gemini"; }
      } else if (keys.deepseek) {
        const rawAi = callDeepseek(keys.deepseek, model || "deepseek-chat", systemPrompt, history, message);
        if (rawAi) { parsed = parseAiJson(rawAi); usedAi = true; activeProvider = "deepseek"; }
      }
    }

    if (!parsed) parsed = faqFallback(message, settings, books);

    const products = enrichProducts(parsed.product_ids || [], books);
    const links = parsed.links || [];
    if (!links.length) links.push({ label: "Catálogo", path: "/shop" });

    return e.json(200, {
      reply: parsed.reply || "",
      suggestions: parsed.suggestions || [],
      links: links,
      products: products,
      ai: usedAi,
      provider: activeProvider,
    });
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});
