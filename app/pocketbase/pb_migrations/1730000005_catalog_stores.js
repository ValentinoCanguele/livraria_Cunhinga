/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Coleções de livros (catálogos temáticos)
  const collections = new Collection({
    name: "book_collections",
    type: "base",
    listRule: "active = true",
    viewRule: "active = true",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "slug", type: "text", required: false },
      { name: "description", type: "editor", required: false },
      { name: "cover", type: "url", required: false },
      { name: "cover_image", type: "file", required: false, maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      { name: "sort_order", type: "number", required: false },
      { name: "active", type: "bool", required: false },
      { name: "featured", type: "bool", required: false },
      { name: "marketing_tagline", type: "text", required: false },
      { name: "seo_title", type: "text", required: false },
      { name: "seo_description", type: "text", required: false },
    ],
  });
  app.save(collections);

  // Lojas físicas
  const stores = new Collection({
    name: "physical_stores",
    type: "base",
    listRule: "active = true",
    viewRule: "active = true",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "province", type: "text", required: true },
      { name: "address", type: "text", required: true },
      { name: "phone", type: "text", required: false },
      { name: "email", type: "email", required: false },
      { name: "hours", type: "text", required: false },
      { name: "image_url", type: "url", required: false },
      { name: "image", type: "file", required: false, maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      { name: "latitude", type: "number", required: false },
      { name: "longitude", type: "number", required: false },
      { name: "maps_url", type: "url", required: false },
      { name: "sort_order", type: "number", required: false },
      { name: "active", type: "bool", required: false },
    ],
  });
  app.save(stores);

  // Campos extra em livros — marketing e coleções
  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    const bookFields = [
      { name: "collection_id", type: "text" },
      { name: "marketing_hook", type: "text" },
      { name: "urgency_text", type: "text" },
      { name: "social_proof", type: "text" },
      { name: "benefit_bullets", type: "json" },
      { name: "seo_keywords", type: "text" },
      { name: "target_audience", type: "text" },
    ];
    for (const f of bookFields) {
      if (!books.fields.getByName(f.name)) {
        if (f.type === "text") books.fields.add(new TextField({ name: f.name, required: false }));
        if (f.type === "json") books.fields.add(new JSONField({ name: f.name, required: false }));
      }
    }
    app.save(books);
  }

  // Campos extra em site_settings — barra superior e rodapé
  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings) {
    const settingFields = [
      { name: "header_welcome_logged", type: "text" },
      { name: "header_welcome_guest", type: "text" },
      { name: "header_cta_text", type: "text" },
      { name: "header_cta_link", type: "text" },
      { name: "footer_tagline", type: "text" },
      { name: "footer_copyright", type: "text" },
      { name: "footer_columns", type: "json" },
      { name: "show_stores_in_footer", type: "bool" },
    ];
    for (const f of settingFields) {
      if (!settings.fields.getByName(f.name)) {
        if (f.type === "text") settings.fields.add(new TextField({ name: f.name, required: false }));
        if (f.type === "json") settings.fields.add(new JSONField({ name: f.name, required: false }));
        if (f.type === "bool") settings.fields.add(new BoolField({ name: f.name, required: false }));
      }
    }
    app.save(settings);
  }

  // Permissões em utilizadores
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (users && !users.fields.getByName("permissions")) {
    users.fields.add(new JSONField({ name: "permissions", required: false }));
    app.save(users);
  }
}, (app) => {
  for (const name of ["book_collections", "physical_stores"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) app.delete(col);
  }
});
