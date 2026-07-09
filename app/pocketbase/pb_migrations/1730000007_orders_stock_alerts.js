/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    const orderFields = [
      { name: "order_type", type: "text" },
      { name: "sale_channel", type: "text" },
    ];
    for (const f of orderFields) {
      if (!orders.fields.getByName(f.name)) {
        orders.fields.add(new TextField({ name: f.name, required: false }));
      }
    }
    // Expandir payment_method para aceitar P2P
    const pm = orders.fields.getByName("payment_method");
    if (pm && pm.type === "select") {
      orders.fields.removeByName("payment_method");
      orders.fields.add(new TextField({ name: "payment_method", required: false }));
    }
    app.save(orders);
  }

  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    for (const f of ["stock_alert", "stock_low"]) {
      if (!books.fields.getByName(f)) {
        books.fields.add(new BoolField({ name: f, required: false }));
      }
    }
    app.save(books);
  }
}, (app) => {});
