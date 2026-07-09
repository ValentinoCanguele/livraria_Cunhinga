/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Hero slides para o slider da homepage
  const heroSlides = new Collection({
    name: "hero_slides",
    type: "base",
    listRule: "active = true",
    viewRule: "active = true",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "subtitle", type: "text", required: false },
      { name: "image", type: "url", required: true },
      { name: "cta_text", type: "text", required: false },
      { name: "cta_link", type: "text", required: false },
      { name: "sort_order", type: "number", required: false },
      { name: "active", type: "bool", required: false },
    ],
  });
  app.save(heroSlides);

  // Encomendas
  const orders = new Collection({
    name: "orders",
    type: "base",
    listRule: "@request.auth.role = 'admin' || customer_email = @request.auth.email",
    viewRule: "@request.auth.role = 'admin' || customer_email = @request.auth.email",
    createRule: "",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "customer_email", type: "email", required: false },
      { name: "customer_name", type: "text", required: false },
      { name: "items", type: "json", required: true },
      { name: "total", type: "number", required: true },
      { name: "status", type: "select", required: false, maxSelect: 1, values: ["pending", "confirmed", "shipped", "cancelled"] },
      { name: "notes", type: "text", required: false },
    ],
  });
  app.save(orders);

  // Newsletter
  const newsletter = new Collection({
    name: "newsletter",
    type: "base",
    listRule: "@request.auth.role = 'admin'",
    viewRule: "@request.auth.role = 'admin'",
    createRule: "",
    updateRule: null,
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "email", type: "email", required: true },
    ],
  });
  app.save(newsletter);

  // Campos extra nos livros
  const books = app.findCollectionByNameOrId("stock_books");
  if (books && !books.fields.getByName("featured")) {
    books.fields.add(new BoolField({ name: "featured", required: false }));
    books.fields.add(new TextField({ name: "isbn", required: false }));
    app.save(books);
  }
}, (app) => {
  for (const name of ["hero_slides", "orders", "newsletter"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) app.delete(col);
  }
});
