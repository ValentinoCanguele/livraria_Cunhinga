/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const catalogRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'";

  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (users) {
    const roleField = users.fields.getByName("role");
    if (roleField && roleField.type === "select") {
      const values = roleField.values || [];
      if (!values.includes("manager")) {
        roleField.values = [...values, "manager"];
      }
    }
    app.save(users);
  }

  for (const name of ["stock_books", "book_collections", "hero_slides"]) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;
    col.createRule = catalogRule;
    col.updateRule = catalogRule;
    col.deleteRule = catalogRule;
    app.save(col);
  }

  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings) {
    settings.updateRule = catalogRule;
    settings.createRule = catalogRule;
    app.save(settings);
  }

  const integrations = app.findCollectionByNameOrId("app_integrations");
  if (integrations) {
    try {
      integrations.createRule = catalogRule;
      integrations.updateRule = catalogRule;
      app.save(integrations);
    } catch {
      // ignore
    }
  }
}, (app) => {
  const adminRule = "@request.auth.role = 'admin'";
  for (const name of ["stock_books", "book_collections", "hero_slides"]) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;
    col.createRule = adminRule;
    col.updateRule = adminRule;
    col.deleteRule = adminRule;
    app.save(col);
  }
});
