/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Configurações globais do site (registo único)
  const siteSettings = new Collection({
    name: "site_settings",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null,
    fields: [
      { name: "site_name", type: "text", required: true },
      { name: "tagline", type: "text", required: false },
      { name: "primary_color", type: "text", required: false },
      { name: "logo_url", type: "url", required: false },
      { name: "logo", type: "file", required: false, maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] },
      { name: "favicon_url", type: "url", required: false },
      { name: "favicon", type: "file", required: false, maxSelect: 1, maxSize: 524288, mimeTypes: ["image/png", "image/x-icon", "image/svg+xml"] },
      { name: "login_bg_url", type: "url", required: false },
      { name: "contact_email", type: "email", required: false },
      { name: "contact_phone", type: "text", required: false },
      { name: "contact_address", type: "text", required: false },
      { name: "whatsapp", type: "text", required: false },
      { name: "facebook", type: "url", required: false },
      { name: "instagram", type: "url", required: false },
      { name: "pwa_enabled", type: "bool", required: false },
      { name: "pwa_name", type: "text", required: false },
      { name: "pwa_short_name", type: "text", required: false },
      { name: "pwa_theme_color", type: "text", required: false },
      { name: "shipping_free_threshold", type: "number", required: false },
      { name: "shipping_cost", type: "number", required: false },
      { name: "maintenance_mode", type: "bool", required: false },
      { name: "google_oauth_enabled", type: "bool", required: false },
    ],
  });
  app.save(siteSettings);

  // Métodos de pagamento P2P configuráveis
  const paymentMethods = new Collection({
    name: "payment_methods",
    type: "base",
    listRule: "enabled = true",
    viewRule: "enabled = true || @request.auth.role = 'admin'",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "code", type: "text", required: true },
      { name: "type", type: "select", required: false, maxSelect: 1, values: ["p2p", "offline", "transfer"] },
      { name: "enabled", type: "bool", required: false },
      { name: "instructions", type: "editor", required: false },
      { name: "account_info", type: "text", required: false },
      { name: "qr_url", type: "url", required: false },
      { name: "qr_code", type: "file", required: false, maxSelect: 1, maxSize: 1048576, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      { name: "icon", type: "text", required: false },
      { name: "sort_order", type: "number", required: false },
    ],
  });
  app.save(paymentMethods);

  // Extensão de encomendas — rastreio de entrega
  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    const orderFields = [
      { name: "shipping_cost", type: "number" },
      { name: "tracking_number", type: "text" },
      { name: "carrier", type: "text" },
      { name: "delivery_status", type: "select", values: ["received", "confirmed", "preparing", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"] },
      { name: "delivery_timeline", type: "json" },
      { name: "estimated_delivery", type: "date" },
      { name: "payment_method_code", type: "text" },
      { name: "payment_reference", type: "text" },
      { name: "payment_status", type: "select", values: ["pending", "awaiting_confirmation", "paid", "failed", "refunded"] },
    ];
    for (const f of orderFields) {
      if (!orders.fields.getByName(f.name)) {
        if (f.type === "text") orders.fields.add(new TextField({ name: f.name, required: false }));
        if (f.type === "number") orders.fields.add(new NumberField({ name: f.name, required: false }));
        if (f.type === "json") orders.fields.add(new JSONField({ name: f.name, required: false }));
        if (f.type === "date") orders.fields.add(new DateField({ name: f.name, required: false }));
        if (f.type === "select") orders.fields.add(new SelectField({ name: f.name, required: false, maxSelect: 1, values: f.values }));
      }
    }
    app.save(orders);
  }

  // Apps auxiliares / integrações
  const appIntegrations = new Collection({
    name: "app_integrations",
    type: "base",
    listRule: "@request.auth.role = 'admin'",
    viewRule: "@request.auth.role = 'admin'",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "code", type: "text", required: true },
      { name: "enabled", type: "bool", required: false },
      { name: "description", type: "text", required: false },
      { name: "config", type: "json", required: false },
      { name: "icon", type: "text", required: false },
    ],
  });
  app.save(appIntegrations);
}, (app) => {
  for (const name of ["site_settings", "payment_methods", "app_integrations"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) app.delete(col);
  }
});
