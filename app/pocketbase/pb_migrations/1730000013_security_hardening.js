/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const staffRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'";

  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings) {
    settings.listRule = staffRule;
    settings.viewRule = staffRule;
    settings.createRule = "@request.auth.role = 'admin'";
    settings.updateRule = staffRule;
    app.save(settings);
  }

  const integrations = app.findCollectionByNameOrId("app_integrations");
  if (integrations) {
    integrations.listRule = staffRule;
    integrations.viewRule = staffRule;
    app.save(integrations);
  }

  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    // Encomendas só via hook /api/app/checkout (superuser) ou admin
    orders.createRule = null;
    app.save(orders);
  }

  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (users) {
    users.deleteRule = "@request.auth.role = 'admin'";
    app.save(users);
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings) {
    settings.listRule = "";
    settings.viewRule = "";
    app.save(settings);
  }
});
