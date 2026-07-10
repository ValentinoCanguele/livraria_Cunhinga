/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings) {
    const fields = [
      { name: "order_email_enabled", type: "bool" },
      { name: "email_provider", type: "select", values: ["pocketbase", "sendgrid", "smtp"] },
      { name: "sendgrid_api_key", type: "text" },
      { name: "smtp_host", type: "text" },
      { name: "smtp_port", type: "number" },
      { name: "smtp_user", type: "text" },
      { name: "smtp_password", type: "text" },
      { name: "smtp_from_email", type: "email" },
      { name: "smtp_from_name", type: "text" },
      { name: "push_enabled", type: "bool" },
      { name: "vapid_public_key", type: "text" },
      { name: "vapid_private_key", type: "text" },
    ];
    for (const f of fields) {
      if (!settings.fields.getByName(f.name)) {
        if (f.type === "bool") settings.fields.add(new BoolField({ name: f.name, required: false }));
        if (f.type === "text") settings.fields.add(new TextField({ name: f.name, required: false }));
        if (f.type === "number") settings.fields.add(new NumberField({ name: f.name, required: false }));
        if (f.type === "email") settings.fields.add(new EmailField({ name: f.name, required: false }));
        if (f.type === "select") settings.fields.add(new SelectField({ name: f.name, required: false, maxSelect: 1, values: f.values }));
      }
    }
    app.save(settings);
  }

  let integrations = null;
  try { integrations = app.findCollectionByNameOrId("app_integrations"); } catch (err) {}
  if (integrations) {
    try {
      app.findFirstRecordByFilter("app_integrations", "code = 'whatsapp_business'");
    } catch (err) {
      const col = integrations;
      const rec = new Record(col);
      rec.set("name", "WhatsApp Business API");
      rec.set("code", "whatsapp_business");
      rec.set("enabled", false);
      rec.set("description", "Envio automático de mensagens via Meta Cloud API");
      rec.set("icon", "💬");
      rec.set("config", { phone_number_id: "", access_token: "", template_name: "order_confirmation" });
      app.save(rec);
    }
  }

  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  const pushSubs = new Collection({
    name: "push_subscriptions",
    type: "base",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      { name: "endpoint", type: "text", required: true },
      { name: "keys", type: "json", required: false },
      { name: "user_agent", type: "text", required: false },
    ],
  });
  if (users) {
    pushSubs.fields.add(new RelationField({
      name: "user",
      required: false,
      collectionId: users.id,
      cascadeDelete: true,
      maxSelect: 1,
    }));
  }
  app.save(pushSubs);
}, (app) => {
  const col = app.findCollectionByNameOrId("push_subscriptions");
  if (col) app.delete(col);
});
