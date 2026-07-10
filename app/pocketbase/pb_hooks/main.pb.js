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

function requireStaffAuth(e) {
  const auth = e.auth;
  if (!isStaff(auth)) throw new ForbiddenError("Acesso restrito a administradores.");
  return auth;
}

function normalizeContactEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeContactPhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

function mergeContactTags(existing, incoming) {
  const merged = [];
  const seen = {};
  const a = Array.isArray(existing) ? existing : [];
  const b = Array.isArray(incoming) ? incoming : [];
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (t && !seen[t]) { seen[t] = true; merged.push(t); }
  }
  for (let j = 0; j < b.length; j++) {
    const t = b[j];
    if (t && !seen[t]) { seen[t] = true; merged.push(t); }
  }
  return merged;
}

function countCollectionRecords(collection, filter) {
  try {
    if (filter) {
      const recs = $app.findRecordsByFilter(collection, filter, 500, 0, "");
      return recs ? recs.length : 0;
    }
    return $app.countRecords(collection);
  } catch (err) {
    return 0;
  }
}

function findContactByExternalOrEmail(externalId, email, phone) {
  if (externalId) {
    try {
      return $app.findFirstRecordByFilter("contacts", "external_id = {:eid}", { eid: externalId });
    } catch (err) {}
  }
  const em = normalizeContactEmail(email);
  if (em) {
    try {
      return $app.findFirstRecordByFilter("contacts", "email = {:email}", { email: em });
    } catch (err) {}
  }
  const ph = normalizeContactPhone(phone);
  if (ph && ph.length >= 9) {
    try {
      const all = $app.findRecordsByFilter("contacts", "phone != ''", 500, 0, "");
      for (let i = 0; i < all.length; i++) {
        if (normalizeContactPhone(all[i].get("phone")) === ph) return all[i];
      }
    } catch (err) {}
  }
  return null;
}

function upsertContact(item, ownerId) {
  const col = $app.findCollectionByNameOrId("contacts");
  const existing = findContactByExternalOrEmail(item.external_id, item.email, item.phone);
  const record = existing || new Record(col);
  if (!existing) {
    record.set("name", item.name || "Sem Nome");
    record.set("source", item.source || "manual");
    if (ownerId) record.set("owner", ownerId);
  }
  if (item.name) record.set("name", item.name);
  if (item.email) record.set("email", normalizeContactEmail(item.email));
  if (item.phone) record.set("phone", item.phone);
  if (item.photo_url) record.set("photo_url", item.photo_url);
  if (item.external_id) record.set("external_id", item.external_id);
  if (item.tags && item.tags.length) {
    record.set("tags", mergeContactTags(existing ? existing.get("tags") : [], item.tags));
  }
  if (item.notes) record.set("notes", item.notes);
  if (item.is_buyer != null) record.set("is_buyer", !!item.is_buyer || (existing ? !!existing.get("is_buyer") : false));
  if (item.metadata) record.set("metadata", item.metadata);
  record.set("last_synced_at", nowISO());
  record.set("sync_status", "synced");
  $app.save(record);
  return { id: record.id, created: !existing };
}

function buildWhatsAppNotifyUrl(phone, message) {
  const digits = normalizeContactPhone(phone);
  const num = digits.startsWith("244") ? digits : "244" + digits.replace(/^0/, "");
  return "https://wa.me/" + num + "?text=" + encodeURIComponent(message || "");
}

function getNewBooksDigest() {
  let books = [];
  try {
    books = $app.findRecordsByFilter("stock_books", "stock > 0", 5, 0, "-created");
  } catch (err) {}
  if (!books.length) return "";
  const lines = ["📚 *Novidades na Livraria Adventista*", ""];
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const price = b.get("price") ? Number(b.get("price")).toLocaleString("pt-AO") + " Kz" : "";
    lines.push("• " + (b.get("title") || "Livro") + (price ? " — " + price : ""));
  }
  lines.push("", "Visite: https://livrariaadventista.ao/shop");
  return lines.join("\n");
}

function calcNextSendAt(frequency) {
  const d = new Date();
  if (frequency === "daily") d.setDate(d.getDate() + 1);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function getDefaultContactOwnerId() {
  try {
    const admins = $app.findRecordsByFilter("users", "role = 'admin'", 1, 0, "");
    if (admins && admins.length) return admins[0].id;
  } catch (err) {}
  return "";
}

function fmtMoneyKz(amount) {
  return Number(amount || 0).toLocaleString("pt-AO", { minimumFractionDigits: 2 }) + " Kz";
}

function buildOrderEmailHtml(order, siteName) {
  const items = order.get("items") || [];
  let rows = "";
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const line = (Number(it.quantity) || 1) * (Number(it.price) || 0);
    rows += "<tr><td style=\"padding:8px;border-bottom:1px solid #eee\">" + (it.quantity || 1) + "× " + (it.title || "Livro") + "</td><td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right\">" + fmtMoneyKz(line) + "</td></tr>";
  }
  const shipping = Number(order.get("shipping_cost")) || 0;
  return [
    "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a\">",
    "<h2 style=\"color:#0ea5c9\">Encomenda Confirmada</h2>",
    "<p>Olá <strong>" + (order.get("customer_name") || "") + "</strong>,</p>",
    "<p>Obrigado pela sua compra na <strong>" + (siteName || "Livraria Adventista") + "</strong>.</p>",
    "<p><strong>Nº:</strong> " + (order.get("order_number") || order.id) + "</p>",
    "<table style=\"width:100%;border-collapse:collapse;margin:16px 0\">",
    "<thead><tr><th style=\"text-align:left;padding:8px;border-bottom:2px solid #0ea5c9\">Livro</th><th style=\"text-align:right;padding:8px;border-bottom:2px solid #0ea5c9\">Total</th></tr></thead>",
    "<tbody>", rows, "</tbody>",
    "</table>",
    "<p>Envio: " + fmtMoneyKz(shipping) + "</p>",
    "<p style=\"font-size:18px\"><strong>Total: " + fmtMoneyKz(order.get("total")) + "</strong></p>",
    "<p style=\"color:#666;font-size:13px\">Acompanhe em /track com o número e email utilizados na compra.</p>",
  ].join("");
}

function sendEmailViaSendGrid(apiKey, fromEmail, fromName, toEmail, subject, html) {
  const res = $http.send({
    url: "https://api.sendgrid.com/v3/mail/send",
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: fromName || "Livraria" },
      subject: subject,
      content: [{ type: "text/html", value: html }],
    }),
    timeout: 30,
  });
  return res.statusCode >= 200 && res.statusCode < 300;
}

function sendTransactionalEmail(settingsRec, toEmail, subject, html) {
  if (!settingsRec || !toEmail) return false;
  const siteName = settingsRec.get("site_name") || "Livraria Adventista";
  const provider = settingsRec.get("email_provider") || "pocketbase";
  const fromEmail = settingsRec.get("smtp_from_email") || settingsRec.get("contact_email") || "noreply@livraria.ao";
  const fromName = settingsRec.get("smtp_from_name") || siteName;

  try {
    if (provider === "sendgrid") {
      const key = settingsRec.get("sendgrid_api_key") || "";
      if (!key) return false;
      return sendEmailViaSendGrid(key, fromEmail, fromName, toEmail, subject, html);
    }
    const message = new MailerMessage({
      from: { address: fromEmail, name: fromName },
      to: [{ address: toEmail }],
      subject: subject,
      html: html,
    });
    $app.newMailClient().send(message);
    return true;
  } catch (err) {
    console.log("Transactional email error: " + err);
    return false;
  }
}

function sendOrderConfirmationEmail(order, settingsRec) {
  if (!settingsRec || !settingsRec.get("order_email_enabled")) return false;
  const toEmail = order.get("customer_email");
  if (!toEmail) return false;

  const siteName = settingsRec.get("site_name") || "Livraria Adventista";
  const subject = "Confirmação de encomenda " + (order.get("order_number") || "");
  const html = buildOrderEmailHtml(order, siteName);
  return sendTransactionalEmail(settingsRec, toEmail, subject, html);
}

function sendContactWhatsAppMessage(phone, body) {
  const config = getWhatsAppBusinessConfig();
  if (config) {
    const result = sendWhatsAppBusinessMessage(phone, body, config);
    return { apiSent: !!result.ok, waUrl: "", error: result.error || "" };
  }
  return { apiSent: false, waUrl: buildWhatsAppNotifyUrl(phone, body), error: "" };
}

function getWhatsAppBusinessConfig() {
  try {
    const rec = $app.findFirstRecordByFilter("app_integrations", "code = 'whatsapp_business'");
    if (!rec || !rec.get("enabled")) return null;
    const cfg = rec.get("config") || {};
    if (!cfg.access_token || !cfg.phone_number_id) return null;
    return cfg;
  } catch (err) {
    return null;
  }
}

function sendWhatsAppBusinessText(phone, text, config) {
  const digits = normalizeContactPhone(phone);
  const to = digits.startsWith("244") ? digits : "244" + digits.replace(/^0/, "");
  const url = "https://graph.facebook.com/v21.0/" + config.phone_number_id + "/messages";
  const res = $http.send({
    url: url,
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: { preview_url: true, body: text },
    }),
    timeout: 30,
  });
  if (res.statusCode >= 200 && res.statusCode < 300) return { ok: true };
  console.log("WhatsApp API text error " + res.statusCode + ": " + (res.raw || ""));
  return { ok: false, status: res.statusCode, error: res.raw || "WhatsApp API error" };
}

function sendWhatsAppBusinessTemplate(phone, config, params) {
  const digits = normalizeContactPhone(phone);
  const to = digits.startsWith("244") ? digits : "244" + digits.replace(/^0/, "");
  const templateName = config.template_name || "order_confirmation";
  const lang = config.template_language || "pt_PT";
  const url = "https://graph.facebook.com/v21.0/" + config.phone_number_id + "/messages";
  const components = [];
  if (params && params.bodyParams && params.bodyParams.length) {
    components.push({
      type: "body",
      parameters: params.bodyParams.map(function (p) {
        return { type: "text", text: String(p) };
      }),
    });
  }
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: lang },
    },
  };
  if (components.length) payload.template.components = components;
  const res = $http.send({
    url: url,
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeout: 30,
  });
  if (res.statusCode >= 200 && res.statusCode < 300) return { ok: true };
  console.log("WhatsApp API template error " + res.statusCode + ": " + (res.raw || ""));
  return { ok: false, status: res.statusCode, error: res.raw || "Template error" };
}

function sendWhatsAppBusinessMessage(phone, text, config, templateParams) {
  if (!phone || !config) return { ok: false, error: "missing_config" };
  if (config.use_template && config.template_name) {
    const params = templateParams && templateParams.bodyParams
      ? templateParams
      : {
        bodyParams: [
          (templateParams && templateParams.customerName) || "Cliente",
          (templateParams && templateParams.orderNumber) || "",
          (templateParams && templateParams.total) || "",
        ],
      };
    const tpl = sendWhatsAppBusinessTemplate(phone, config, params);
    if (tpl.ok) return tpl;
  }
  return sendWhatsAppBusinessText(phone, text, config);
}

function isWhatsAppBusinessReady() {
  const cfg = getWhatsAppBusinessConfig();
  return !!(cfg && cfg.access_token && cfg.phone_number_id);
}

function buildOrderWhatsAppMessage(order, siteName) {
  const items = order.get("items") || [];
  const lines = [
    "✅ *Encomenda Confirmada — " + (siteName || "Livraria Adventista") + "*",
    "Nº: " + (order.get("order_number") || ""),
    "",
    "Olá " + (order.get("customer_name") || "") + "!",
    "",
    "*Livros:*",
  ];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    lines.push("• " + (it.quantity || 1) + "× " + (it.title || "Livro"));
  }
  lines.push("", "*Total: " + fmtMoneyKz(order.get("total")) + "*", "", "Obrigado pela sua compra! 📚");
  return lines.join("\n");
}

function sendOrderWhatsAppConfirmation(order, settingsRec) {
  const config = getWhatsAppBusinessConfig();
  if (!config) return false;
  const phone = order.get("phone");
  if (!phone) return false;
  const siteName = settingsRec ? settingsRec.get("site_name") : "Livraria Adventista";
  const msg = buildOrderWhatsAppMessage(order, siteName);
  const result = sendWhatsAppBusinessMessage(phone, msg, config, {
    customerName: order.get("customer_name") || "Cliente",
    orderNumber: order.get("order_number") || "",
    total: fmtMoneyKz(order.get("total")),
    bodyParams: [
      order.get("customer_name") || "Cliente",
      order.get("order_number") || "",
      fmtMoneyKz(order.get("total")),
    ],
  });
  if (result.ok) {
    const storePhone = settingsRec ? (settingsRec.get("whatsapp") || settingsRec.get("contact_phone") || "") : "";
    if (storePhone) {
      try {
        const saleChannel = order.get("sale_channel") || "";
        if (saleChannel === "whatsapp") {
          const storeMsg = "🛒 *Nova encomenda WhatsApp*\nNº: " + (order.get("order_number") || "") + "\nCliente: " + (order.get("customer_name") || "") + "\nTel: " + phone + "\nTotal: " + fmtMoneyKz(order.get("total"));
          sendWhatsAppBusinessText(storePhone, storeMsg, config);
        }
      } catch (err) {}
    }
    return true;
  }
  return false;
}

function sendWhatsAppReceipt(phone, text, orderNumber, customerEmail) {
  const config = getWhatsAppBusinessConfig();
  if (!config || !phone) return { ok: false, error: "not_configured" };
  if (orderNumber && customerEmail) {
    try {
      const order = $app.findFirstRecordByFilter("orders", "order_number = {:n}", { n: orderNumber });
      if (order && (order.get("customer_email") || "").toLowerCase() !== String(customerEmail).toLowerCase()) {
        return { ok: false, error: "email_mismatch" };
      }
    } catch (err) {}
  }
  return sendWhatsAppBusinessMessage(phone, text, config);
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
    order_email_enabled: !!rec.get("order_email_enabled"),
    push_enabled: !!rec.get("push_enabled"),
    vapid_public_key: rec.get("vapid_public_key") || "",
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

  let emailSent = false;
  let whatsappSent = false;
  try {
    emailSent = sendOrderConfirmationEmail(order, settings);
    whatsappSent = sendOrderWhatsAppConfirmation(order, settings);
  } catch (err) {
    console.log("Post-checkout messaging: " + err);
  }

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
    email_sent: emailSent,
    whatsapp_sent: whatsappSent,
  });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof NotFoundError || err instanceof ForbiddenError) {
      throw err;
    }
    return e.json(400, { message: err.message || String(err) });
  }
});

// --- Messaging status (público, sem segredos) ---
routerAdd("GET", "/api/app/messaging/status", (e) => {
  try {
    const settings = getSettingsRecord();
    const waCfg = getWhatsAppBusinessConfig();
    let waEnabled = false;
    try {
      const r = $app.findFirstRecordByFilter("app_integrations", "code = 'whatsapp_business'");
      waEnabled = !!(r && r.get("enabled"));
    } catch (err) {}
    return e.json(200, {
      whatsapp: {
        enabled: waEnabled,
        configured: !!waCfg,
        auto_send: waCfg ? (waCfg.auto_send !== false) : false,
        use_template: !!(waCfg && waCfg.use_template),
      },
      email: {
        enabled: !!(settings && settings.get("order_email_enabled")),
        provider: settings ? (settings.get("email_provider") || "pocketbase") : "pocketbase",
      },
      push: {
        enabled: !!(settings && settings.get("push_enabled")),
        has_vapid: !!(settings && settings.get("vapid_public_key")),
      },
    });
  } catch (err) {
    return e.json(200, { whatsapp: { enabled: false, configured: false }, email: { enabled: false }, push: { enabled: false } });
  }
});

routerAdd("POST", "/api/app/whatsapp/receipt", (e) => {
  try {
    const data = e.requestInfo().body;
    const phone = (data.phone || "").trim();
    const text = (data.text || "").trim();
    const orderNumber = (data.order_number || "").trim();
    const email = (data.email || "").trim();
    if (!phone || !text) throw new BadRequestError("Telefone e texto do recibo são obrigatórios.");
    if (!isWhatsAppBusinessReady()) {
      return e.json(200, { sent: false, fallback: true, message: "API WhatsApp não configurada — use link manual." });
    }
    const result = sendWhatsAppReceipt(phone, text, orderNumber, email);
    return e.json(200, {
      sent: !!result.ok,
      fallback: !result.ok,
      message: result.ok ? "Recibo enviado por WhatsApp." : (result.error || "Falha no envio."),
    });
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/admin/whatsapp/test", (e) => {
  try {
    requireStaffAuth(e);
    const data = e.requestInfo().body;
    const phone = (data.phone || "").trim();
    if (!phone) throw new BadRequestError("Indique um número de teste.");
    const config = getWhatsAppBusinessConfig();
    if (!config) throw new BadRequestError("WhatsApp Business API não está activa ou configurada.");
    const text = "✅ Teste — Livraria Adventista\n\nA integração WhatsApp Business API está funcional. Mensagens automáticas activas.";
    const result = sendWhatsAppBusinessMessage(phone, text, config, {
      bodyParams: ["Teste", "OK", "0 Kz"],
    });
    if (!result.ok) throw new BadRequestError("Falha Meta API (" + (result.status || "") + "): " + (result.error || "erro desconhecido"));
    return e.json(200, { message: "Mensagem de teste enviada para " + phone + "." });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

// --- CRM Contactos: sincronização, importação e notificações ---
routerAdd("GET", "/api/app/push/config", (e) => {
  try {
    const rec = $app.findFirstRecordByFilter("site_settings", "id != ''");
    if (!rec || !rec.get("push_enabled")) return e.json(200, { enabled: false, publicKey: "" });
    return e.json(200, {
      enabled: true,
      publicKey: rec.get("vapid_public_key") || "",
    });
  } catch (err) {
    return e.json(200, { enabled: false, publicKey: "" });
  }
});

routerAdd("POST", "/api/app/push/subscribe", (e) => {
  try {
    const data = e.requestInfo().body;
    const endpoint = (data.endpoint || "").trim();
    if (!endpoint) throw new BadRequestError("Endpoint obrigatório.");

    let existing = null;
    try {
      existing = $app.findFirstRecordByFilter("push_subscriptions", "endpoint = {:ep}", { ep: endpoint });
    } catch (err) {}

    const col = $app.findCollectionByNameOrId("push_subscriptions");
    const rec = existing || new Record(col);
    rec.set("endpoint", endpoint);
    rec.set("keys", data.keys || {});
    rec.set("user_agent", data.user_agent || "");
    let auth = null;
    try { auth = e.auth; } catch (err) {}
    if (auth && auth.id) rec.set("user", auth.id);
    else if (data.user) rec.set("user", data.user);
    $app.save(rec);
    return e.json(200, { message: "Subscrição push registada." });
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/contact-message", (e) => {
  try {
    const data = e.requestInfo().body;
    const name = (data.name || "").trim();
    const email = normalizeContactEmail(data.email || "");
    const message = (data.message || "").trim();
    const phone = (data.phone || "").trim();
    if (!name || !email || !message) throw new BadRequestError("Nome, email e mensagem são obrigatórios.");

    const ownerId = getDefaultContactOwnerId();
    upsertContact({
      name: name,
      email: email,
      phone: phone,
      source: "manual",
      notes: message,
      tags: ["formulario-contacto"],
    }, ownerId);

    return e.json(200, { message: "Mensagem recebida! Entraremos em contacto em breve." });
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/contacts/sync-batch", (e) => {
  try {
  const auth = requireStaffAuth(e);
  const data = e.requestInfo().body;
  const items = data.contacts || [];
  if (!items.length) throw new BadRequestError("Lista de contactos vazia.");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name && !item.email && !item.phone) { skipped++; continue; }
    const result = upsertContact(item, auth.id);
    if (result.created) created++;
    else updated++;
  }
  return e.json(200, { message: "Sincronização concluída.", created: created, updated: updated, skipped: skipped, total: items.length });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/contacts/import-sources", (e) => {
  try {
  const auth = requireStaffAuth(e);
  let created = 0;
  let updated = 0;

  let orders = [];
  try { orders = $app.findAllRecords("orders"); } catch (err) {}
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const email = o.get("customer_email") || "";
    const phone = o.get("phone") || "";
    const name = o.get("customer_name") || o.get("name") || "Cliente";
    if (!email && !phone) continue;
    const result = upsertContact({
      name: name,
      email: email,
      phone: phone,
      source: "order",
      is_buyer: true,
      tags: ["comprador"],
    }, auth.id);
    if (result.created) created++;
    else updated++;
  }

  let subs = [];
  try { subs = $app.findAllRecords("newsletter"); } catch (err) {}
  for (let j = 0; j < subs.length; j++) {
    const s = subs[j];
    const email = s.get("email") || "";
    if (!email) continue;
    const result = upsertContact({
      name: email.split("@")[0],
      email: email,
      source: "newsletter",
      tags: ["newsletter"],
    }, auth.id);
    if (result.created) created++;
    else updated++;
  }

  return e.json(200, { message: "Importação concluída.", created: created, updated: updated });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("GET", "/api/app/contacts/stats", (e) => {
  try {
  requireStaffAuth(e);
  return e.json(200, {
    total: countCollectionRecords("contacts"),
    google: countCollectionRecords("contacts", "source = 'google'"),
    buyers: countCollectionRecords("contacts", "is_buyer = true"),
    groups: countCollectionRecords("contact_groups"),
    active_campaigns: countCollectionRecords("contact_campaigns", "is_active = true"),
  });
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/contacts/notify", (e) => {
  try {
  const auth = requireStaffAuth(e);
  const data = e.requestInfo().body;
  const contactIds = data.contact_ids || [];
  const channel = data.channel || "whatsapp";
  const subject = data.subject || "Novidades — Livraria Adventista";
  let body = data.body || "";
  const groupId = data.group_id || "";

  if (!contactIds.length) throw new BadRequestError("Seleccione pelo menos um contacto.");

  const notifCol = $app.findCollectionByNameOrId("contact_notifications");
  const results = [];
  let settingsRec = null;
  try { settingsRec = $app.findFirstRecordByFilter("site_settings", "id != ''"); } catch (err) {}

  for (let i = 0; i < contactIds.length; i++) {
    let contact = null;
    try { contact = $app.findRecordById("contacts", contactIds[i]); } catch (err) {}
    if (!contact) continue;

    const notif = new Record(notifCol);
    notif.set("owner", auth.id);
    notif.set("contact", contact.id);
    if (groupId) notif.set("group", groupId);
    notif.set("channel", channel);
    notif.set("subject", subject);
    notif.set("body", body);
    notif.set("status", "pending");
    notif.set("sent_at", nowISO());

    let waUrl = "";
    let status = "failed";
    let whatsappApiSent = false;
    let emailSent = false;
    const hasPhone = !!(contact.get("phone") || "").trim();
    const hasEmail = !!(contact.get("email") || "").trim();

    if (channel === "whatsapp") {
      if (hasPhone) {
        const wa = sendContactWhatsAppMessage(contact.get("phone"), body);
        waUrl = wa.waUrl;
        whatsappApiSent = wa.apiSent;
        if (wa.waUrl) notif.set("whatsapp_url", waUrl);
        status = (wa.apiSent || wa.waUrl) ? "sent" : "failed";
      }
    } else if (channel === "email") {
      if (hasEmail && settingsRec) {
        const html = "<div style=\"font-family:sans-serif;line-height:1.6\">" + String(body).replace(/\n/g, "<br>") + "</div>";
        emailSent = sendTransactionalEmail(settingsRec, contact.get("email"), subject, html);
        status = emailSent ? "sent" : "failed";
      } else {
        status = "failed";
      }
    } else if (channel === "both") {
      let waOk = false;
      if (hasPhone) {
        const wa = sendContactWhatsAppMessage(contact.get("phone"), body);
        waUrl = wa.waUrl;
        whatsappApiSent = wa.apiSent;
        if (wa.waUrl) notif.set("whatsapp_url", waUrl);
        waOk = wa.apiSent || !!wa.waUrl;
      }
      if (hasEmail && settingsRec) {
        const html = "<div style=\"font-family:sans-serif;line-height:1.6\">" + String(body).replace(/\n/g, "<br>") + "</div>";
        emailSent = sendTransactionalEmail(settingsRec, contact.get("email"), subject, html);
      }
      status = (waOk || emailSent) ? "sent" : "failed";
    }
    notif.set("status", status);

    $app.save(notif);
    contact.set("last_contacted_at", nowISO());
    $app.save(contact);

    results.push({
      contact_id: contact.id,
      name: contact.get("name"),
      email: contact.get("email") || "",
      phone: contact.get("phone") || "",
      whatsapp_url: waUrl,
      whatsapp_api_sent: whatsappApiSent,
      email_sent: emailSent,
      channel: channel,
      status: notif.get("status"),
    });
  }

  return e.json(200, { message: "Notificações processadas.", results: results, whatsapp_api: isWhatsAppBusinessReady() });
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

routerAdd("POST", "/api/app/contacts/campaigns/run-due", (e) => {
  try {
  const auth = requireStaffAuth(e);
  const now = new Date().toISOString();
  let campaigns = [];
  try {
    campaigns = $app.findRecordsByFilter("contact_campaigns", "is_active = true", 50, 0, "");
  } catch (err) {}

  const digest = getNewBooksDigest();
  let processed = 0;
  const allResults = [];

  for (let i = 0; i < campaigns.length; i++) {
    const camp = campaigns[i];
    const nextSend = camp.get("next_send_at");
    if (nextSend && nextSend > now) continue;

    const groupId = camp.get("group");
    if (!groupId) continue;

    let group = null;
    try { group = $app.findRecordById("contact_groups", groupId); } catch (err) {}
    if (!group) continue;

    const memberIds = group.get("member_ids") || [];
    if (!memberIds.length) continue;

    let body = camp.get("message_template") || "";
    if (camp.get("include_new_books") && digest) {
      body = body ? body + "\n\n" + digest : digest;
    }

    const channel = camp.get("channel") || "whatsapp";
    const subject = camp.get("subject") || "Novidades — Livraria Adventista";
    let settingsRec = null;
    try { settingsRec = $app.findFirstRecordByFilter("site_settings", "id != ''"); } catch (err) {}

    for (let j = 0; j < memberIds.length; j++) {
      let contact = null;
      try { contact = $app.findRecordById("contacts", memberIds[j]); } catch (err) {}
      if (!contact) continue;

      const notifCol = $app.findCollectionByNameOrId("contact_notifications");
      const notif = new Record(notifCol);
      notif.set("owner", auth.id);
      notif.set("contact", contact.id);
      notif.set("group", groupId);
      notif.set("campaign", camp.id);
      notif.set("channel", channel);
      notif.set("subject", subject);
      notif.set("body", body);
      notif.set("sent_at", nowISO());

      let waUrl = "";
      let status = "failed";
      if (channel === "whatsapp" || channel === "both") {
        const phone = contact.get("phone");
        if (phone) {
          const wa = sendContactWhatsAppMessage(phone, body);
          waUrl = wa.waUrl;
          if (waUrl) notif.set("whatsapp_url", waUrl);
          status = (wa.apiSent || waUrl) ? "sent" : "failed";
        }
      }
      if (channel === "email" || channel === "both") {
        const email = contact.get("email");
        if (email && settingsRec) {
          const html = "<div style=\"font-family:sans-serif;line-height:1.6\">" + String(body).replace(/\n/g, "<br>") + "</div>";
          const emailOk = sendTransactionalEmail(settingsRec, email, subject, html);
          if (channel === "email") status = emailOk ? "sent" : "failed";
          else if (emailOk) status = "sent";
        } else if (channel === "email") {
          status = "failed";
        }
      }
      notif.set("status", status);
      $app.save(notif);
      contact.set("last_contacted_at", now);
      $app.save(contact);

      allResults.push({
        campaign: camp.get("name"),
        contact: contact.get("name"),
        whatsapp_url: waUrl,
        status: notif.get("status"),
      });
    }

    camp.set("last_sent_at", now);
    camp.set("next_send_at", calcNextSendAt(camp.get("frequency") || "weekly"));
    $app.save(camp);
    processed++;
  }

  return e.json(200, { message: "Campanhas processadas.", processed: processed, notifications: allResults });
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
    return e.json(400, { message: err.message || String(err) });
  }
});

onRecordCreate((e) => {
  try {
    const record = e.record;
    if (record.get("owner")) return;
    const auth = e.auth;
    if (auth && auth.id) record.set("owner", auth.id);
  } catch (err) {}
}, "contacts");

onRecordCreate((e) => {
  try {
    const record = e.record;
    if (record.get("owner")) return;
    const auth = e.auth;
    if (auth && auth.id) record.set("owner", auth.id);
  } catch (err) {}
}, "contact_groups");

onRecordCreate((e) => {
  try {
    const record = e.record;
    if (record.get("owner")) return;
    const auth = e.auth;
    if (auth && auth.id) record.set("owner", auth.id);
    if (!record.get("next_send_at")) {
      const d = new Date();
      d.setHours(d.getHours() + 1);
      record.set("next_send_at", d.toISOString());
    }
  } catch (err) {}
}, "contact_campaigns");

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
  try {
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
  } catch (err) {
    console.log("Error in orders hook: " + err);
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
  try {
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
  } catch (err) {
    console.log("Error in stock_books hook: " + err);
  }
}, "stock_books");

onRecordValidate((e) => {
  try {
    const record = e.record;
    const image = record.get("image");
    if (image) record.set("image", normalizeDriveCoverUrl(image));
    const bookCover = record.get("book_cover");
    if (bookCover) record.set("book_cover", normalizeDriveCoverUrl(bookCover));
  } catch (err) {
    console.log("Error in hero_slides hook: " + err);
  }
}, "hero_slides");

// Impede escalada de privilégios em contas de utilizador
onRecordCreate((e) => {
  try {
    const record = e.record;
    let auth = null;
    try {
      auth = e.requestInfo().auth;
    } catch (err) {}

    let isRoot = false;
    try {
      if (e.requestInfo().admin) isRoot = true;
      else if (auth && auth.collection().name === "_superusers") isRoot = true;
      else if (auth && auth.get("role") === "admin") isRoot = true;
    } catch (err) {}

    if (!isRoot) {
      record.set("role", "member");
      try { record.set("permissions", null); } catch (err) {}
    }
  } catch (err) {
    console.log("Error in users create hook: " + err);
  }
}, "users");

onRecordUpdate((e) => {
  try {
    let isRoot = false;
    let auth = null;
    try {
      auth = e.requestInfo().auth;
    } catch (err) {}

    try {
      if (e.requestInfo().admin) isRoot = true;
      else if (auth && auth.collection().name === "_superusers") isRoot = true;
      else if (auth && auth.get("role") === "admin") isRoot = true;
    } catch (err) {}

    if (isRoot) return;

    const record = e.record;
    const original = record.originalCopy();
    if (original) {
      record.set("role", original.get("role") || "member");
      record.set("permissions", original.get("permissions"));
    }
  } catch (err) {
    console.log("Error in users update hook: " + err);
  }
}, "users");
