/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const books = app.findCollectionByNameOrId("stock_books");
  if (!books) return;

  const fields = [
    { name: "book_code", type: "text", required: false },
    { name: "sku", type: "text", required: false },
    { name: "publisher", type: "text", required: false },
    { name: "language", type: "text", required: false },
    { name: "pages", type: "number", required: false },
    { name: "year", type: "number", required: false },
  ];

  for (const f of fields) {
    if (!books.fields.getByName(f.name)) {
      if (f.type === "text") books.fields.add(new TextField({ name: f.name, required: false }));
      if (f.type === "number") books.fields.add(new NumberField({ name: f.name, required: false }));
    }
  }

  app.save(books);
}, (app) => {
  // rollback opcional
});
