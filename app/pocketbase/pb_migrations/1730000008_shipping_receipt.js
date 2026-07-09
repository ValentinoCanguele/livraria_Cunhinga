/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    for (const f of [
      { name: "shipping_method", type: "text" },
      { name: "pickup_store", type: "text" },
    ]) {
      if (!orders.fields.getByName(f.name)) {
        orders.fields.add(new TextField({ name: f.name, required: false }));
      }
    }
    app.save(orders);
  }

  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings && !settings.fields.getByName("shipping_express_cost")) {
    settings.fields.add(new NumberField({ name: "shipping_express_cost", required: false }));
    app.save(settings);
  }
}, (app) => {});
