/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (!settings) return;
  const fields = [
      { name: "chat_enabled", type: "bool", default: true },
    { name: "chat_provider", type: "select", values: ["gemini", "deepseek", "faq"] },
    { name: "gemini_api_key", type: "text" },
    { name: "deepseek_api_key", type: "text" },
    { name: "chat_model", type: "text" },
    { name: "chat_welcome", type: "text" },
  ];
  for (const f of fields) {
    if (!settings.fields.getByName(f.name)) {
      if (f.type === "bool") settings.fields.add(new BoolField({ name: f.name, required: false, defaultValue: f.default === true }));
      if (f.type === "text") settings.fields.add(new TextField({ name: f.name, required: false }));
      if (f.type === "select") settings.fields.add(new SelectField({ name: f.name, required: false, maxSelect: 1, values: f.values }));
    }
  }
  app.save(settings);
}, (app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (!settings) return;
  ["chat_enabled", "chat_provider", "gemini_api_key", "deepseek_api_key", "chat_model", "chat_welcome"].forEach((name) => {
    const f = settings.fields.getByName(name);
    if (f) settings.fields.removeById(f.id);
  });
  app.save(settings);
});
