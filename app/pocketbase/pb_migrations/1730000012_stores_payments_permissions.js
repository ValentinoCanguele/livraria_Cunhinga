/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const catalogRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'";

  const stores = app.findCollectionByNameOrId("physical_stores");
  if (stores) {
    stores.createRule = catalogRule;
    stores.updateRule = catalogRule;
    stores.deleteRule = catalogRule;
    app.save(stores);
  }

  const payments = app.findCollectionByNameOrId("payment_methods");
  if (payments) {
    payments.createRule = catalogRule;
    payments.updateRule = catalogRule;
    payments.deleteRule = catalogRule;
    app.save(payments);
  }
}, (app) => {
  const adminRule = "@request.auth.role = 'admin'";
  for (const name of ["physical_stores", "payment_methods"]) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;
    col.createRule = adminRule;
    col.updateRule = adminRule;
    col.deleteRule = adminRule;
    app.save(col);
  }
});
