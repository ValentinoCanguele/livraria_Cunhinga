/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (!orders) return;

  const fields = [
    { name: "order_number", type: "text" },
    { name: "phone", type: "text" },
    { name: "address", type: "text" },
    { name: "city", type: "text" },
    { name: "payment_method", type: "select", values: ["entrega", "transferencia"] },
  ];

  for (const f of fields) {
    if (!orders.fields.getByName(f.name)) {
      if (f.type === "text") orders.fields.add(new TextField({ name: f.name, required: false }));
      if (f.type === "select") orders.fields.add(new SelectField({ name: f.name, required: false, maxSelect: 1, values: f.values }));
    }
  }

  app.save(orders);
}, (app) => {});
