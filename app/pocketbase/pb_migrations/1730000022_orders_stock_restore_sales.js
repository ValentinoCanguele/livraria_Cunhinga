/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (orders && !orders.fields.getByName("stock_restored")) {
    orders.fields.add(new BoolField({ name: "stock_restored", required: false }));
    app.save(orders);
  }

  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    for (const f of ["sales_count", "views_count"]) {
      if (!books.fields.getByName(f)) {
        books.fields.add(new NumberField({ name: f, required: false, min: 0 }));
      }
    }
    try {
      books.addIndex("idx_stock_books_genre", false, "genre", "");
      app.save(books);
    } catch (err) {
      console.log("stock_books genre index: " + err);
      app.save(books);
    }
  }
}, (app) => {
  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    const field = orders.fields.getByName("stock_restored");
    if (field) {
      orders.fields.removeById(field.id);
      app.save(orders);
    }
  }
  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    try { books.removeIndex("idx_stock_books_genre"); } catch (err) {}
    for (const name of ["sales_count", "views_count"]) {
      const field = books.fields.getByName(name);
      if (field) books.fields.removeById(field.id);
    }
    app.save(books);
  }
});
