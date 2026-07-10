/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/app/chat/config", (e) => {
  function loadSettings() {
    try {
      const list = $app.findRecordsByFilter("site_settings", "id != ''", 1, 0, "-updated");
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
      const list = $app.findRecordsByFilter("site_settings", "id != ''", 1, 0, "-updated");
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
    const lim = limit || 6;
    const q = (query || "").trim().toLowerCase();
    let books = [];
    try {
      if (q.length >= 2) {
        const safe = q.replace(/"/g, "");
        books = $app.findRecordsByFilter(
          "stock_books",
          "stock > 0 && (title ~ {:q} || author ~ {:q} || genre ~ {:q})",
          lim, 0, "-featured,-created",
          { q: safe }
        );
      }
      if (!books.length) {
        books = $app.findRecordsByFilter("stock_books", "stock > 0 && featured = true", lim, 0, "-created");
      }
    } catch (err) {}
    const out = [];
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      out.push({
        id: b.id,
        title: b.get("title") || "",
        author: b.get("author") || "",
        price: b.get("price") ? String(Number(b.get("price"))) + " Kz" : "",
        cover: b.get("cover") || "",
        genre: b.get("genre") || "",
        stock: Number(b.get("stock")) || 0,
      });
    }
    return out;
  }
  function buildPrompt(settingsRec, books, page) {
    const site = settingsRec ? (settingsRec.get("site_name") || "Livraria Adventista") : "Livraria Adventista";
    const shipping = settingsRec ? Number(settingsRec.get("shipping_free_threshold")) || 20000 : 20000;
    let catalog = "";
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      catalog += "- [" + b.id + "] " + b.title + " | " + b.author + " | " + b.price + "\n";
    }
    return [
      "Assistente da " + site + ". Responde em português de Portugal.",
      "Página: " + (page || "/") + ". Serviços: /shop, /track, /contact, /faq.",
      "Envio grátis acima de " + String(Math.round(shipping)) + " Kz.",
      "Catálogo:\n" + catalog,
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
      contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: String(h.content).slice(0, 1500) }] });
    }
    contents.push({ role: "user", parts: [{ text: String(userMessage).slice(0, 1500) }] });
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
      messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.content).slice(0, 1500) });
    }
    messages.push({ role: "user", content: String(userMessage).slice(0, 1500) });
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
  function faqFallback(message, settingsRec) {
    const q = (message || "").toLowerCase();
    let reply = "";
    if (q.indexOf("envio") >= 0 || q.indexOf("entrega") >= 0) reply = "A entrega padrão demora 5-7 dias úteis em Luanda e 7-14 noutras províncias.";
    else if (q.indexOf("grátis") >= 0 || q.indexOf("gratis") >= 0) reply = "Envio grátis para encomendas acima do limiar configurado na loja.";
    else if (q.indexOf("pagamento") >= 0 || q.indexOf("pagar") >= 0) reply = "Aceitamos transferência, Multicaixa Express e pagamento na entrega.";
    else if (q.indexOf("rastrear") >= 0 || q.indexOf("encomenda") >= 0) reply = "Rastreie em /track com o número e email da compra.";
    else if (q.indexOf("catálogo") >= 0 || q.indexOf("catalogo") >= 0 || q.indexOf("livro") >= 0) reply = "Explore o catálogo em /shop ou diga-me o tema que procura.";
    else {
      const wa = settingsRec ? (settingsRec.get("whatsapp") || settingsRec.get("contact_phone") || "") : "";
      reply = "Posso ajudar com envios, pagamentos e catálogo. Visite /contact" + (wa ? " ou WhatsApp " + wa : "") + ".";
    }
    return {
      reply: reply,
      suggestions: ["Ver catálogo", "Envio grátis?", "Rastrear encomenda", "Falar com a equipa"],
      links: [{ label: "Loja", path: "/shop" }, { label: "FAQ", path: "/faq" }, { label: "Contacto", path: "/contact" }],
      product_ids: [],
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

  try {
    const data = e.requestInfo().body;
    const message = (data.message || "").trim();
    const page = (data.page || "/").slice(0, 120);
    const history = data.history || [];
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

    if (!parsed) parsed = faqFallback(message, settings);

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
