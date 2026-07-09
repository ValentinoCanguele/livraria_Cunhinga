/// <reference path="../pb_data/types.d.ts" />

function nowISO() {
  return new Date().toISOString();
}

function makeTimelineEvent(status, title, desc, location) {
  return { status: status, title: title, description: desc || "", location: location || "Luanda", at: nowISO() };
}

function calcShippingServer(method, subtotal, settings) {
  const freeThreshold = (Number(settings.get("shipping_free_threshold")) || 20000);
  const standardCost = Number(settings.get("shipping_cost")) || 1500;
  const expressCost = Number(settings.get("shipping_express_cost")) || standardCost * 2;
  const sub = Number(subtotal) || 0;
  if (method === "pickup") return 0;
  if (method === "express") return Math.max(0, expressCost);
  if (sub >= freeThreshold) return 0;
  return Math.max(0, standardCost);
}

function isStaff(auth) {
  if (!auth) return false;
  const role = auth.get("role");
  return role === "admin" || role === "manager";
}

function buildDeliveryAddressFull(parts) {
  const bits = [];
  if (parts.street) bits.push(parts.street);
  if (parts.locality) bits.push(parts.locality);
  if (parts.municipality) bits.push(parts.municipality);
  if (parts.province) bits.push(parts.province);
  let full = bits.join(", ");
  if (parts.reference) full += (full ? " — Ref: " : "Ref: ") + parts.reference;
  if (full) full += ", Angola";
  return full;
}

function safeSetOrderField(order, field, value) {
  if (value === undefined || value === null) return;
  try { order.set(field, value); } catch (err) {}
}

function validateCheckoutSignature(sig) {
  if (!sig || typeof sig !== "string") return false;
  if (!sig.startsWith("data:image/png;base64,")) return false;
  if (sig.length > 200000) return false;
  return true;
}

function sanitizeIntegrationConfig(code, config) {
  if (!config || typeof config !== "object") return {};
  if (code === "google_drive") {
    return {
      folder_id: config.folder_id || "",
      has_api_key: !!(config.api_key),
      has_client_id: !!(config.client_id),
    };
  }
  return {};
}

function getDriveIntegration() {
  try {
    const records = $app.findRecordsByFilter("app_integrations", "code = 'google_drive'", 1, 0, "");
    if (!records || !records.length) return null;
    return records[0];
  } catch (err) {
    return null;
  }
}

function getSettingsRecord() {
  try {
    return $app.findFirstRecordByFilter("site_settings", "id != ''");
  } catch (err) {}
  return null;
}

function fileUrl(record, field) {
  const f = record.get(field);
  if (!f) return "";
  try {
    return $app.files().getUrl(record, f);
  } catch (err) {
    return "";
  }
}

function settingsFileUrl(record, field) {
  const f = record.get(field);
  if (!f) return "";
  try {
    return $app.files().getUrl(record, f);
  } catch (err) {
    return "";
  }
}

function resolveShopBgMode(rec) {
  const mode = rec.get("shop_bg_mode") || "gradient";
  if (mode === "image" && !(rec.get("shop_bg_image_url") || "")) return "gradient";
  if (mode === "video" && !(rec.get("shop_bg_video_url") || "")) return "gradient";
  if (mode !== "gradient" && mode !== "image" && mode !== "video" && mode !== "slides") return "gradient";
  return mode;
}

// --- API pública: configurações do site ---
routerAdd("GET", "/api/app/settings", (e) => {
  try {
  let rec = null;
  try {
    rec = $app.findFirstRecordByFilter("site_settings", "id != ''");
  } catch (err) {}

  if (!rec) {
    return e.json(200, {
      site_name: "Livraria Adventista",
      tagline: "Literatura que edifica e transforma",
      primary_color: "#0ea5c9",
      logo_url: "",
      favicon_url: "",
      contact_email: "contacto@livrariaadventista.ao",
      contact_phone: "+244 923 000 000",
      contact_address: "Luanda, Angola",
      pwa_enabled: true,
      pwa_theme_color: "#0c4a6e",
      shipping_free_threshold: 20000,
      shipping_cost: 1500,
      maintenance_mode: false,
      google_oauth_enabled: false,
      header_welcome_logged: "Bem-vindo de volta, {nome}",
      header_welcome_guest: "Envio em todo o país · Crie a sua conta para acompanhar encomendas",
      header_cta_text: "Explorar novidades",
      header_cta_link: "/shop",
      footer_tagline: "",
      footer_copyright: "",
      footer_columns: null,
      show_stores_in_footer: true,
      ui_glass_enabled: true,
      ui_glass_opacity: 0.72,
      shop_bg_mode: "gradient",
      shop_bg_image_url: "",
      shop_bg_video_url: "",
      shop_bg_overlay: 0.55,
    });
  }

  function resolveBrandImage(record, urlField, fileField) {
    const f = record.get(fileField);
    let file = "";
    if (f) {
      try { file = $app.files().getUrl(record, f); } catch (err) {}
    }
    if (file) return file;
    const url = record.get(urlField) || "";
    if (url && url.indexOf("blob:") !== 0) return url;
    return "";
  }

  function resolveBgMode(record) {
    const mode = record.get("shop_bg_mode") || "gradient";
    if (mode === "image" && !(record.get("shop_bg_image_url") || "")) return "gradient";
    if (mode === "video" && !(record.get("shop_bg_video_url") || "")) return "gradient";
    if (mode !== "gradient" && mode !== "image" && mode !== "video" && mode !== "slides") return "gradient";
    return mode;
  }

  const footerCols = rec.get("footer_columns");
  const assetsVersion = rec.get("updated") || rec.get("created") || "";
  return e.json(200, {
    site_name: rec.get("site_name") || "Livraria Adventista",
    tagline: rec.get("tagline") || "",
    primary_color: rec.get("primary_color") || "#0ea5c9",
    logo_url: resolveBrandImage(rec, "logo_url", "logo"),
    favicon_url: resolveBrandImage(rec, "favicon_url", "favicon"),
    assets_version: assetsVersion,
    login_bg_url: rec.get("login_bg_url") || "",
    contact_email: rec.get("contact_email") || "",
    contact_phone: rec.get("contact_phone") || "",
    contact_address: rec.get("contact_address") || "",
    whatsapp: rec.get("whatsapp") || "",
    facebook: rec.get("facebook") || "",
    instagram: rec.get("instagram") || "",
    pwa_enabled: !!rec.get("pwa_enabled"),
    pwa_name: rec.get("pwa_name") || rec.get("site_name"),
    pwa_short_name: rec.get("pwa_short_name") || "LA",
    pwa_theme_color: rec.get("pwa_theme_color") || "#0c4a6e",
    shipping_free_threshold: Number(rec.get("shipping_free_threshold")) || 20000,
    shipping_cost: Number(rec.get("shipping_cost")) || 1500,
    shipping_express_cost: Number(rec.get("shipping_express_cost")) || 0,
    maintenance_mode: !!rec.get("maintenance_mode"),
    google_oauth_enabled: !!rec.get("google_oauth_enabled"),
    header_welcome_logged: rec.get("header_welcome_logged") || "Bem-vindo de volta, {nome}",
    header_welcome_guest: rec.get("header_welcome_guest") || "Envio em todo o país · Crie a sua conta para acompanhar encomendas",
    header_cta_text: rec.get("header_cta_text") || "Explorar novidades",
    header_cta_link: rec.get("header_cta_link") || "/shop",
    footer_tagline: rec.get("footer_tagline") || "",
    footer_copyright: rec.get("footer_copyright") || "",
    footer_columns: footerCols || null,
    show_stores_in_footer: rec.get("show_stores_in_footer") == null ? true : !!rec.get("show_stores_in_footer"),
    shop_hero_title: rec.get("shop_hero_title") || "Todos os Livros",
    shop_hero_subtitle: rec.get("shop_hero_subtitle") || "",
    shop_hero_badge: rec.get("shop_hero_badge") || "Catálogo Premium",
    shop_default_sort: rec.get("shop_default_sort") || "featured",
    shop_per_page: Number(rec.get("shop_per_page")) || 24,
    shop_show_featured: rec.get("shop_show_featured") == null ? true : !!rec.get("shop_show_featured"),
    shop_show_collections: rec.get("shop_show_collections") == null ? true : !!rec.get("shop_show_collections"),
    shop_show_low_stock: rec.get("shop_show_low_stock") == null ? true : !!rec.get("shop_show_low_stock"),
    shop_grid_columns: Number(rec.get("shop_grid_columns")) || 4,
    ui_glass_enabled: rec.get("ui_glass_enabled") == null ? true : !!rec.get("ui_glass_enabled"),
    ui_glass_opacity: Number(rec.get("ui_glass_opacity")) || 0.72,
    shop_bg_mode: resolveBgMode(rec),
    shop_bg_image_url: rec.get("shop_bg_image_url") || "",
    shop_bg_video_url: rec.get("shop_bg_video_url") || "",
    shop_bg_overlay: Number(rec.get("shop_bg_overlay")) || 0.55,
    google_maps_embed_key: rec.get("google_maps_embed_key") || "",
  });
  } catch (err) {
    return e.json(400, { message: err.message || String(err) });
  }
});

// --- Integrações públicas ---
routerAdd("GET", "/api/app/integrations", (e) => {
  const out = {};
  let records = [];
  try {
    records = $app.findAllRecords("app_integrations");
  } catch (err) {}
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const code = r.get("code");
    if (!code) continue;
    let config = r.get("config");
    if (typeof config !== "object" || config === null) config = {};
    out[code] = {
      enabled: !!r.get("enabled"),
      name: r.get("name") || code,
      config: sanitizeIntegrationConfig(code, config),
    };
  }
  // OAuth também reflecte site_settings
  try {
    const settings = $app.findFirstRecordByFilter("site_settings", "id != ''");
    if (settings) {
      if (!out.google_oauth) out.google_oauth = { enabled: false, config: {} };
      out.google_oauth.enabled = !!settings.get("google_oauth_enabled");
    }
  } catch (err) {}
  return e.json(200, { integrations: out });
});

// --- Config media admin (credenciais Drive — só staff autenticado) ---
routerAdd("GET", "/api/app/admin/media-config", (e) => {
  const auth = e.auth;
  if (!isStaff(auth)) {
    throw new ForbiddenError("Acesso negado.");
  }
  const drive = getDriveIntegration();
  if (!drive || !drive.get("enabled")) {
    return e.json(200, { google_drive: { enabled: false, config: {} } });
  }
  const config = drive.get("config") || {};
  return e.json(200, {
    google_drive: {
      enabled: true,
      config: {
        api_key: config.api_key || "",
        client_id: config.client_id || "",
        folder_id: config.folder_id || "",
      },
    },
  });
});

// --- Lista imagens Drive (proxy server-side — API key nunca exposta ao público) ---
routerAdd("GET", "/api/app/admin/drive-images", (e) => {
  const auth = e.auth;
  if (!isStaff(auth)) {
    throw new ForbiddenError("Acesso negado.");
  }
  const drive = getDriveIntegration();
  if (!drive || !drive.get("enabled")) {
    return e.json(200, { files: [] });
  }
  const config = drive.get("config") || {};
  const apiKey = config.api_key || "";
  const folderId = e.requestInfo().query.folder_id || config.folder_id || "";
  if (!apiKey || !folderId) {
    throw new BadRequestError("Configure API key e pasta do Google Drive.");
  }
  const q = encodeURIComponent("'" + folderId + "' in parents and mimeType contains 'image/' and trashed=false");
  const fields = encodeURIComponent("files(id,name,mimeType,thumbnailLink)");
  const url = "https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=" + fields + "&key=" + encodeURIComponent(apiKey) + "&supportsAllDrives=true&includeItemsFromAllDrives=true";
  const res = $http.send({ url: url, method: "GET", timeout: 30 });
  if (res.statusCode !== 200) {
    throw new BadRequestError("Não foi possível listar imagens do Google Drive.");
  }
  const data = res.json || {};
  const files = (data.files || []).map(function(f) {
    return {
      id: f.id,
      name: f.name,
      thumb: f.thumbnailLink || ("https://drive.google.com/uc?export=view&id=" + f.id),
      url: "https://drive.google.com/uc?export=view&id=" + f.id,
    };
  });
  return e.json(200, { files: files });
});

// --- Lojas físicas públicas ---
routerAdd("GET", "/api/app/stores", (e) => {
  function storeFileUrl(record, field) {
    const f = record.get(field);
    if (!f) return "";
    try {
      return $app.files().getUrl(record, f);
    } catch (err) {
      return "";
    }
  }
  let records = [];
  try {
    records = $app.findAllRecords("physical_stores");
    records = records.filter(function(r) { return r.get("active"); });
  } catch (err) {}
  const stores = records.map(function(r) {
    return {
      id: r.get("id"),
      name: r.get("name"),
      province: r.get("province"),
      address: r.get("address"),
      phone: r.get("phone") || "",
      hours: r.get("hours") || "",
      image_url: r.get("image_url") || storeFileUrl(r, "image"),
      latitude: r.get("latitude"),
      longitude: r.get("longitude"),
      maps_url: r.get("maps_url") || "",
    };
  });
  return e.json(200, { stores: stores });
});

// --- Coleções públicas ---
routerAdd("GET", "/api/app/book-collections", (e) => {
  function colFileUrl(record, field) {
    const f = record.get(field);
    if (!f) return "";
    try {
      return $app.files().getUrl(record, f);
    } catch (err) {
      return "";
    }
  }
  let records = [];
  try {
    records = $app.findAllRecords("book_collections");
    records = records.filter(function(r) { return r.get("active"); });
  } catch (err) {}
  const collections = records.map(function(r) {
    return {
      id: r.get("id"),
      title: r.get("title"),
      slug: r.get("slug") || "",
      description: r.get("description") || "",
      cover: r.get("cover") || colFileUrl(r, "cover_image"),
      featured: !!r.get("featured"),
      marketing_tagline: r.get("marketing_tagline") || "",
      seo_title: r.get("seo_title") || "",
      seo_description: r.get("seo_description") || "",
    };
  });
  return e.json(200, { collections: collections });
});

// --- Métodos de pagamento activos ---
routerAdd("GET", "/api/app/payment-methods", (e) => {
  let records = [];
  try {
    const result = $app.findRecordsByFilter("payment_methods", "enabled = true", 50, 0, "sort_order");
    records = result || [];
  } catch (err) {
    try {
      records = $app.findAllRecords("payment_methods").filter((r) => r.get("enabled"));
    } catch (err) {}
  }
  const methods = records.map((r) => ({
    id: r.get("id"),
    name: r.get("name"),
    code: r.get("code"),
    type: r.get("type") || "offline",
    instructions: r.get("instructions") || "",
    account_info: r.get("account_info") || "",
    qr_url: r.get("qr_url") || fileUrl(r, "qr_code"),
    icon: r.get("icon") || "",
  }));
  return e.json(200, { methods: methods });
});

// --- Rastreio de encomenda (email + número) ---
routerAdd("POST", "/api/app/track", (e) => {
  const data = e.requestInfo().body;
  const orderNumber = (data.orderNumber || "").trim();
  const email = (data.email || "").trim().toLowerCase();

  if (!orderNumber || !email) {
    throw new BadRequestError("Número da encomenda e email são obrigatórios.");
  }

  let order;
  try {
    order = $app.findFirstRecordByFilter(
      "orders",
      "(order_number = {:num} || id = {:num}) && customer_email = {:email}",
      { num: orderNumber, email: email }
    );
  } catch (err) {
    throw new NotFoundError("Encomenda não encontrada. Verifique o número e o email.");
  }

  return e.json(200, {
    order_number: order.get("order_number"),
    status: order.get("status"),
    delivery_status: order.get("delivery_status") || "received",
    total: order.get("total"),
    customer_name: order.get("customer_name"),
    phone: order.get("phone") || "",
    delivery_relative_name: order.get("delivery_relative_name") || "",
    delivery_relative_phone: order.get("delivery_relative_phone") || "",
    address: order.get("address"),
    city: order.get("city"),
    delivery_province: order.get("delivery_province") || "",
    delivery_municipality: order.get("delivery_municipality") || "",
    delivery_locality: order.get("delivery_locality") || "",
    delivery_street: order.get("delivery_street") || "",
    delivery_reference: order.get("delivery_reference") || "",
    delivery_address_full: order.get("delivery_address_full") || order.get("address") || "",
    delivery_confirmed_at: order.get("delivery_confirmed_at") || "",
    delivery_confirmed_by: order.get("delivery_confirmed_by") || "",
    delivery_recipient_name: order.get("delivery_recipient_name") || "",
    delivery_signature_data: order.get("delivery_signature_data") || "",
    tracking_number: order.get("tracking_number") || "",
    carrier: order.get("carrier") || "",
    estimated_delivery: order.get("estimated_delivery") || "",
    payment_status: order.get("payment_status") || "pending",
    timeline: order.get("delivery_timeline") || [],
    created: order.get("created"),
  });
});

// --- Mapa administrativo Angola (Censo 2024) ---
routerAdd("GET", "/api/app/geo/provinces", (e) => {
  try {
    let hasData = false;
    try {
      const existing = $app.findRecordsByFilter("angola_provinces", "id != ''", 1, 0, "");
      hasData = existing && existing.length > 0;
    } catch (err) {}

    if (!hasData) {
      const paths = [
        $filepath.join(__hooks, "data", "angola-geo-2024.json"),
        $filepath.join($filepath.dir(__hooks), "data", "angola-geo-2024.json"),
        $filepath.join("pb_hooks", "data", "angola-geo-2024.json"),
        $filepath.join("data", "angola-geo-2024.json"),
      ];
      let raw = "";
      for (let pi = 0; pi < paths.length; pi++) {
        try {
          const content = $os.readFile(paths[pi]);
          if (!content) continue;
          if (typeof content === "string") { raw = content; break; }
          if (content.length) {
            let out = "";
            for (let j = 0; j < content.length; j++) out += String.fromCharCode(content[j]);
            raw = out;
            break;
          }
        } catch (err) {}
      }
      if (raw) {
        const data = JSON.parse(raw);
        const provCol = $app.findCollectionByNameOrId("angola_provinces");
        const muniCol = $app.findCollectionByNameOrId("angola_municipalities");
        const locCol = $app.findCollectionByNameOrId("angola_localities");
        const provincesData = data.provinces || [];
        for (let pxi = 0; pxi < provincesData.length; pxi++) {
          const p = provincesData[pxi];
          const provRec = new Record(provCol);
          provRec.set("name", p.name);
          provRec.set("slug", p.slug);
          provRec.set("capital", p.capital || "");
          provRec.set("sort_order", p.sort_order || pxi + 1);
          provRec.set("census_version", data.version || "RGPH-2024");
          $app.save(provRec);
          const munis = p.municipalities || [];
          for (let mxi = 0; mxi < munis.length; mxi++) {
            const m = munis[mxi];
            const muniRec = new Record(muniCol);
            muniRec.set("province", provRec.id);
            muniRec.set("name", m.name);
            muniRec.set("slug", m.slug || "");
            muniRec.set("sort_order", m.sort_order || mxi + 1);
            $app.save(muniRec);
            const locs = m.localities || [];
            for (let lxi = 0; lxi < locs.length; lxi++) {
              const l = locs[lxi];
              const locRec = new Record(locCol);
              locRec.set("municipality", muniRec.id);
              locRec.set("name", l.name);
              locRec.set("type", l.type || "bairro");
              locRec.set("sort_order", l.sort_order || lxi + 1);
              $app.save(locRec);
            }
          }
        }
      }
    }

    let records = [];
    try {
      records = $app.findRecordsByFilter("angola_provinces", "id != ''", 500, 0, "sort_order");
    } catch (err) {
      return e.json(200, { provinces: [], version: "RGPH-2024" });
    }
    const provinces = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      provinces.push({
        id: r.id,
        name: r.get("name"),
        slug: r.get("slug"),
        capital: r.get("capital"),
        sort_order: r.get("sort_order"),
      });
    }
    return e.json(200, { provinces: provinces, version: "RGPH-2024", count: provinces.length });
  } catch (err) {
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("GET", "/api/app/geo/municipalities", (e) => {
  const provinceId = (e.requestInfo().query.province || "").trim();
  if (!provinceId) throw new BadRequestError("Parâmetro province obrigatório.");

  let filter = "province = {:pid}";
  let params = { pid: provinceId };
  try {
    const bySlug = $app.findFirstRecordByFilter("angola_provinces", "slug = {:slug}", { slug: provinceId });
    if (bySlug) {
      filter = "province = {:pid}";
      params = { pid: bySlug.id };
    }
  } catch (err) {}

  let records = [];
  try {
    records = $app.findRecordsByFilter("angola_municipalities", filter, 500, 0, "sort_order", params);
  } catch (err) {
    return e.json(200, { municipalities: [] });
  }
  const municipalities = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    municipalities.push({
      id: r.id,
      name: r.get("name"),
      slug: r.get("slug"),
      sort_order: r.get("sort_order"),
      province: r.get("province"),
    });
  }
  return e.json(200, { municipalities: municipalities, count: municipalities.length });
});

routerAdd("GET", "/api/app/geo/localities", (e) => {
  const municipalityId = (e.requestInfo().query.municipality || "").trim();
  if (!municipalityId) throw new BadRequestError("Parâmetro municipality obrigatório.");

  let records = [];
  try {
    records = $app.findRecordsByFilter("angola_localities", "municipality = {:mid}", 500, 0, "sort_order", { mid: municipalityId });
  } catch (err) {
    return e.json(200, { localities: [] });
  }
  const localities = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    localities.push({
      id: r.id,
      name: r.get("name"),
      type: r.get("type"),
      sort_order: r.get("sort_order"),
      municipality: r.get("municipality"),
    });
  }
  return e.json(200, { localities: localities, count: localities.length });
});

// --- Comprador confirma recepção com assinatura ---
routerAdd("POST", "/api/app/confirm-delivery", (e) => {
  const data = e.requestInfo().body;
  const orderNumber = (data.orderNumber || "").trim();
  const email = (data.email || "").trim().toLowerCase();
  const recipientName = (data.recipientName || "").trim();
  const recipientId = (data.recipientId || "").trim();
  const signature = (data.signature || "").trim();

  if (!orderNumber || !email) throw new BadRequestError("Número da encomenda e email são obrigatórios.");
  if (!recipientName) throw new BadRequestError("Nome de quem recebe é obrigatório.");
  if (!signature || signature.indexOf("data:image") !== 0) throw new BadRequestError("Assinatura inválida.");

  let order;
  try {
    order = $app.findFirstRecordByFilter(
      "orders",
      "(order_number = {:num} || id = {:num}) && customer_email = {:email}",
      { num: orderNumber, email: email }
    );
  } catch (err) {
    throw new NotFoundError("Encomenda não encontrada.");
  }

  if (order.get("delivery_confirmed_at")) {
    throw new BadRequestError("Esta encomenda já foi confirmada pelo comprador.");
  }

  const status = order.get("delivery_status") || "received";
  const allowed = ["shipped", "in_transit", "out_for_delivery", "delivered"];
  if (allowed.indexOf(status) < 0) {
    throw new BadRequestError("A encomenda ainda não está disponível para confirmação de recepção.");
  }

  const timeline = order.get("delivery_timeline") || [];
  timeline.push(makeTimelineEvent(
    "delivered",
    "Recepção confirmada pelo comprador",
    "Assinatura digital registada por " + recipientName + (recipientId ? " (doc. " + recipientId + ")" : ""),
    order.get("delivery_municipality") || order.get("city") || ""
  ));

  order.set("delivery_status", "delivered");
  order.set("delivery_timeline", timeline);
  order.set("delivery_confirmed_at", new Date().toISOString());
  order.set("delivery_confirmed_by", recipientName);
  order.set("delivery_recipient_name", recipientName);
  order.set("delivery_recipient_id", recipientId);
  order.set("delivery_signature_data", signature);
  $app.save(order);

  return e.json(200, {
    order_number: order.get("order_number"),
    delivery_status: order.get("delivery_status"),
    delivery_confirmed_at: order.get("delivery_confirmed_at"),
    delivery_confirmed_by: order.get("delivery_confirmed_by"),
    delivery_recipient_name: order.get("delivery_recipient_name"),
    delivery_signature_data: order.get("delivery_signature_data"),
    timeline: order.get("delivery_timeline"),
  });
});

// --- Admin: adicionar evento de entrega ---
routerAdd("POST", "/api/app/delivery-event", (e) => {
  const auth = e.auth;
  if (!isStaff(auth)) {
    throw new ForbiddenError("Acesso negado.");
  }

  const data = e.requestInfo().body;
  const orderId = data.orderId;
  if (!orderId) throw new BadRequestError("orderId obrigatório.");

  let order;
  try {
    order = $app.findRecordById("orders", orderId);
  } catch (err) {
    throw new NotFoundError("Encomenda não encontrada.");
  }

  const timeline = order.get("delivery_timeline") || [];
  const event = makeTimelineEvent(
    data.status || "in_transit",
    data.title || "Actualização de entrega",
    data.description || "",
    data.location || ""
  );
  timeline.push(event);
  order.set("delivery_timeline", timeline);

  if (data.status) order.set("delivery_status", data.status);
  if (data.tracking_number) order.set("tracking_number", data.tracking_number);
  if (data.carrier) order.set("carrier", data.carrier);
  if (data.estimated_delivery) order.set("estimated_delivery", data.estimated_delivery);

  $app.save(order);
  return e.json(200, { timeline: timeline });
});

// --- Checkout melhorado ---
routerAdd("POST", "/api/app/checkout", (e) => {
  try {
  const data = e.requestInfo().body;
  const items = data.items || [];

  if (!items.length) throw new BadRequestError("Carrinho vazio.");

  const email = (data.customerEmail || "").trim();
  const name = (data.customerName || "").trim();
  const phone = (data.phone || "").trim();
  const address = (data.address || "").trim();
  const shippingMethod = data.shippingMethod || "delivery";
  const pickupStore = (data.pickupStore || "").trim();

  if (!email) throw new BadRequestError("Email obrigatório.");
  if (!name) throw new BadRequestError("Nome obrigatório.");
  if (!phone) throw new BadRequestError("Telefone obrigatório.");
  if (shippingMethod !== "pickup") {
    if (!data.deliveryProvince) throw new BadRequestError("Província de entrega obrigatória.");
    if (!data.deliveryMunicipality) throw new BadRequestError("Município de entrega obrigatório.");
    if (!data.deliveryLocality) throw new BadRequestError("Bairro/comuna/localidade obrigatória.");
    if (!(data.deliveryStreet || "").trim()) throw new BadRequestError("Morada (rua/avenida) obrigatória.");
    if (!(data.deliveryReference || "").trim()) throw new BadRequestError("Ponto de referência obrigatório para entrega.");
    if (!address) throw new BadRequestError("Morada de entrega incompleta.");
  }
  if (shippingMethod === "pickup" && !pickupStore && !address) throw new BadRequestError("Seleccione a loja de levantamento.");

  const checkoutSignature = data.checkoutSignature || "";
  if (!validateCheckoutSignature(checkoutSignature)) {
    throw new BadRequestError("Assinatura do comprador obrigatória. Assine no quadro.");
  }

  // Modo manutenção
  let settings = null;
  try {
    settings = $app.findFirstRecordByFilter("site_settings", "id != ''");
  } catch (err) {}
  if (settings && settings.get("maintenance_mode")) {
    throw new BadRequestError("Loja em manutenção. Tente mais tarde.");
  }

  function parseBookId(variantId) {
    if (!variantId) return "";
    return String(variantId).replace(/-(default|v\d+)$/, "");
  }

  function timelineEvent(status, title, desc, location) {
    return {
      status: status,
      title: title,
      description: desc || "",
      location: location || "Luanda",
      at: new Date().toISOString(),
    };
  }

  let total = 0;
  const orderItems = [];
  const stockUpdates = [];

  for (const item of items) {
    const bookId = parseBookId(item.variant_id || item.book_id || "");
    const quantity = Math.min(Math.max(Number(item.quantity) || 1, 1), 99);
    if (!bookId) throw new BadRequestError("Item inválido no carrinho.");

    let book;
    try {
      book = $app.findRecordById("stock_books", bookId);
    } catch (err) {
      throw new BadRequestError("Livro não encontrado.");
    }

    const stock = Number(book.get("stock")) || 0;
    if (stock < quantity) {
      throw new BadRequestError("Stock insuficiente para: " + book.get("title"));
    }

    const price = Number(book.get("price")) || 0;
    total += price * quantity;
    orderItems.push({
      book_id: bookId,
      title: book.get("title"),
      book_code: book.get("book_code") || "",
      quantity: quantity,
      price: price,
    });
    stockUpdates.push({ book: book, newStock: stock - quantity });
  }

  const itemsSubtotal = total;
  const shippingCost = calcShippingServer(shippingMethod, itemsSubtotal, settings || {});
  total = itemsSubtotal + shippingCost;

  const deliveryAddress = shippingMethod === "pickup"
    ? ("Levantamento: " + (pickupStore || "Loja física"))
    : (data.deliveryAddressFull || address);

  const deliveryCity = shippingMethod === "pickup"
    ? (pickupStore || "Loja física")
    : (data.deliveryMunicipality || data.city || "Luanda");

  const timelineLocation = shippingMethod === "pickup"
    ? (pickupStore || "Loja física")
    : (data.deliveryMunicipality || data.deliveryProvince || "Angola");

  const orderNum = "ENC-" + Date.now().toString(36).toUpperCase().slice(-6);
  const paymentCode = data.paymentMethodCode || data.paymentMethod || "entrega";
  const isP2P = paymentCode !== "entrega" && paymentCode !== "transferencia";
  const saleChannel = data.saleChannel || data.orderType || "web_purchase";
  const isWhatsApp = saleChannel === "whatsapp";

  const timeline = [
    timelineEvent("received", isWhatsApp ? "Pedido via WhatsApp" : "Compra registada", isWhatsApp ? "Cliente iniciou pedido pelo WhatsApp." : "A sua compra foi registada com sucesso.", timelineLocation),
  ];

  const orders = $app.findCollectionByNameOrId("orders");
  const order = new Record(orders);
  order.set("order_number", orderNum);
  order.set("customer_email", email);
  order.set("customer_name", name);
  order.set("phone", phone);
  order.set("address", deliveryAddress);
  order.set("city", deliveryCity);
  if (shippingMethod !== "pickup") {
    safeSetOrderField(order, "delivery_province_id", data.deliveryProvinceId || "");
    safeSetOrderField(order, "delivery_province", data.deliveryProvince || "");
    safeSetOrderField(order, "delivery_municipality_id", data.deliveryMunicipalityId || "");
    safeSetOrderField(order, "delivery_municipality", data.deliveryMunicipality || "");
    safeSetOrderField(order, "delivery_locality_id", data.deliveryLocalityId || "");
    safeSetOrderField(order, "delivery_locality", data.deliveryLocality || "");
    safeSetOrderField(order, "delivery_street", (data.deliveryStreet || "").trim());
    safeSetOrderField(order, "delivery_reference", (data.deliveryReference || "").trim());
    safeSetOrderField(order, "delivery_address_full", data.deliveryAddressFull || deliveryAddress);
    safeSetOrderField(order, "delivery_relative_name", (data.deliveryRelativeName || "").trim());
    safeSetOrderField(order, "delivery_relative_phone", (data.deliveryRelativePhone || "").trim());
  }
  safeSetOrderField(order, "checkout_signature_data", checkoutSignature);
  safeSetOrderField(order, "checkout_signature_at", new Date().toISOString());
  try { order.set("shipping_method", shippingMethod); } catch (err) {}
  try { order.set("pickup_store", pickupStore); } catch (err) {}
  order.set("payment_method_code", paymentCode);
  order.set("payment_reference", data.paymentReference || "");
  // payment_method é select limitado — só definir valores conhecidos
  if (paymentCode === "entrega" || paymentCode === "transferencia") {
    order.set("payment_method", paymentCode);
  }
  order.set("payment_status", isP2P ? "awaiting_confirmation" : "pending");
  order.set("shipping_cost", shippingCost);
  order.set("delivery_status", "received");
  order.set("delivery_timeline", timeline);
  order.set("items", orderItems);
  order.set("total", total);
  order.set("status", "pending");
  if (data.notes) order.set("notes", data.notes);
  try { order.set("sale_channel", saleChannel); } catch (err) {}
  try { order.set("order_type", isWhatsApp ? "whatsapp_order" : "online_purchase"); } catch (err) {}
  $app.save(order);

  for (const u of stockUpdates) {
    const newStock = u.newStock;
    u.book.set("stock", newStock);
    try {
      if (newStock <= 0) u.book.set("stock_alert", true);
      else if (newStock <= 5) u.book.set("stock_low", true);
    } catch (err) {}
    $app.save(u.book);
  }

  const successUrl = data.successUrl || "/success";
  const sep = successUrl.indexOf("?") >= 0 ? "&" : "?";
  const redirectUrl = successUrl + sep + "orderId=" + order.get("id") + "&orderNumber=" + orderNum + "&total=" + total + "&type=" + (isWhatsApp ? "whatsapp" : "purchase");

  return e.json(200, {
    url: redirectUrl,
    orderId: order.get("id"),
    orderNumber: orderNum,
    total: total,
    payment_status: order.get("payment_status"),
    order_type: isWhatsApp ? "whatsapp_order" : "online_purchase",
    sale_channel: saleChannel,
  });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      throw err;
    }
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/newsletter", (e) => {
  const data = e.requestInfo().body;
  const email = (data.email || "").trim().toLowerCase();
  if (!email) throw new BadRequestError("Email obrigatório.");

  try {
    $app.findFirstRecordByFilter("newsletter", "email = {:email}", { email: email });
    return e.json(200, { message: "Já subscrito." });
  } catch (err) {}

  const col = $app.findCollectionByNameOrId("newsletter");
  const record = new Record(col);
  record.set("email", email);
  $app.save(record);
  return e.json(200, { message: "Subscrição realizada!" });
});

// Timeline automática ao mudar estado de entrega
onRecordUpdate((e) => {
  const record = e.record;
  const original = record.originalCopy();
  const newStatus = record.get("delivery_status");
  const oldStatus = original ? original.get("delivery_status") : null;

  if (newStatus && newStatus !== oldStatus) {
    const labels = {
      received: "Encomenda recebida",
      confirmed: "Encomenda confirmada",
      preparing: "A preparar envio",
      shipped: "Enviada",
      in_transit: "Em trânsito",
      out_for_delivery: "Saiu para entrega",
      delivered: "Entregue",
      cancelled: "Cancelada",
    };
    const timeline = record.get("delivery_timeline") || [];
    timeline.push(makeTimelineEvent(newStatus, labels[newStatus] || newStatus, "", record.get("city") || ""));
    record.set("delivery_timeline", timeline);
  }
}, "orders");

function normalizeDriveCoverUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed.indexOf("blob:") === 0) return "";
  let m = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return "https://drive.google.com/uc?export=view&id=" + m[1];
  m = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return "https://drive.google.com/uc?export=view&id=" + m[1];
  return trimmed;
}

onRecordValidate((e) => {
  const record = e.record;
  if (!record.get("book_code")) {
    const seq = Date.now().toString(36).toUpperCase().slice(-5);
    record.set("book_code", "LA-" + seq);
  }
  if (!record.get("sku")) record.set("sku", record.get("book_code"));
  if (!record.get("publisher")) record.set("publisher", "Livraria Adventista");
  if (!record.get("language")) record.set("language", "Português");
  const cover = record.get("cover");
  if (cover) record.set("cover", normalizeDriveCoverUrl(cover));
  const authorPhoto = record.get("author_photo");
  if (authorPhoto) record.set("author_photo", normalizeDriveCoverUrl(authorPhoto));
}, "stock_books");

onRecordValidate((e) => {
  const record = e.record;
  const image = record.get("image");
  if (image) record.set("image", normalizeDriveCoverUrl(image));
  const bookCover = record.get("book_cover");
  if (bookCover) record.set("book_cover", normalizeDriveCoverUrl(bookCover));
}, "hero_slides");

// Impede escalada de privilégios em contas de utilizador
onRecordCreate((e) => {
  const record = e.record;
  const auth = e.requestInfo().auth;
  if (!auth || auth.get("role") !== "admin") {
    record.set("role", "member");
    try { record.set("permissions", null); } catch (err) {}
  }
}, "users");

onRecordUpdate((e) => {
  const auth = e.requestInfo().auth;
  if (auth && auth.get("role") === "admin") return;
  const record = e.record;
  const original = record.originalCopy();
  if (original) {
    record.set("role", original.get("role") || "member");
    record.set("permissions", original.get("permissions"));
  }
}, "users");
