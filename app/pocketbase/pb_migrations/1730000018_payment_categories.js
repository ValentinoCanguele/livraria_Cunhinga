/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const payments = app.findCollectionByNameOrId("payment_methods");
  if (payments) {
    if (!payments.fields.getByName("category")) {
      payments.fields.add(new SelectField({
        name: "category",
        required: false,
        maxSelect: 1,
        values: ["gateway", "balcao", "on_delivery"],
      }));
    }
    if (!payments.fields.getByName("gateway_provider")) {
      payments.fields.add(new TextField({ name: "gateway_provider", required: false, max: 80 }));
    }
    if (!payments.fields.getByName("requires_reference")) {
      payments.fields.add(new BoolField({ name: "requires_reference", required: false }));
    }
    app.save(payments);

    try {
      const all = app.findAllRecords("payment_methods");
      for (let i = 0; i < all.length; i++) {
        const r = all[i];
        const code = r.get("code") || "";
        let category = r.get("category");
        if (!category) {
          if (code === "balcao") category = "balcao";
          else if (code === "entrega") category = "on_delivery";
          else category = "gateway";
          r.set("category", category);
        }
        if (category === "gateway" && r.get("requires_reference") == null) {
          const type = r.get("type") || "";
          r.set("requires_reference", type === "p2p" || type === "transfer");
        }
        if (code === "multicaixa" && !r.get("gateway_provider")) {
          r.set("gateway_provider", "multicaixa_express");
        }
        if (code === "transferencia" && !r.get("gateway_provider")) {
          r.set("gateway_provider", "bank_transfer");
        }
        app.save(r);
      }
      // Criar método balcão se não existir
      try {
        app.findFirstRecordByFilter("payment_methods", "code = 'balcao'");
      } catch (err) {
        const col = app.findCollectionByNameOrId("payment_methods");
        const rec = new Record(col);
        rec.set("name", "Pagar no Balcão");
        rec.set("code", "balcao");
        rec.set("category", "balcao");
        rec.set("type", "offline");
        rec.set("enabled", true);
        rec.set("sort_order", 10);
        rec.set("icon", "🏪");
        rec.set("instructions", "Dirija-se a uma das nossas lojas físicas com o número da encomenda. Pague em dinheiro, Multicaixa ou cartão no balcão.");
        app.save(rec);
      }
    } catch (err) {}
  }

  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    if (!orders.fields.getByName("payment_category")) {
      orders.fields.add(new TextField({ name: "payment_category", required: false, max: 40 }));
    }
    if (!orders.fields.getByName("payment_method_name")) {
      orders.fields.add(new TextField({ name: "payment_method_name", required: false, max: 120 }));
    }
    app.save(orders);
  }
}, (app) => {
  const payments = app.findCollectionByNameOrId("payment_methods");
  if (payments) {
    for (const name of ["category", "gateway_provider", "requires_reference"]) {
      const field = payments.fields.getByName(name);
      if (field) payments.fields.remove(field.id);
    }
    app.save(payments);
  }
  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    for (const name of ["payment_category", "payment_method_name"]) {
      const field = orders.fields.getByName(name);
      if (field) orders.fields.remove(field.id);
    }
    app.save(orders);
  }
});
