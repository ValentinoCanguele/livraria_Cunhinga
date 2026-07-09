/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (!orders) return;

  const fields = [
    { name: "checkout_signature_data", type: "text" },
    { name: "checkout_signature_at", type: "date" },
    { name: "delivery_relative_name", type: "text" },
    { name: "delivery_relative_phone", type: "text" },
  ];

  for (const f of fields) {
    if (!orders.fields.getByName(f.name)) {
      if (f.type === "text") orders.fields.add(new TextField({ name: f.name, required: false }));
      if (f.type === "date") orders.fields.add(new DateField({ name: f.name, required: false }));
    }
  }
  app.save(orders);
}, (app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (!orders) return;
  for (const name of ["checkout_signature_data", "checkout_signature_at", "delivery_relative_name", "delivery_relative_phone"]) {
    const field = orders.fields.getByName(name);
    if (field) orders.fields.remove(field.id);
  }
  app.save(orders);
});
