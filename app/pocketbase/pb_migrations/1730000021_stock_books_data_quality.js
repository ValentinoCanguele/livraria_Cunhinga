/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    try {
      books.addIndex("idx_stock_books_book_code_unique", true, "book_code", "book_code != ''");
      app.save(books);
    } catch (err) {
      console.log("stock_books index: " + err);
    }
  }

  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    try {
      orders.addIndex("idx_orders_order_number_unique", true, "order_number", "order_number != ''");
      app.save(orders);
    } catch (err) {
      console.log("orders index: " + err);
    }
  }
}, (app) => {
  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    try { books.removeIndex("idx_stock_books_book_code_unique"); app.save(books); } catch (err) {}
  }
  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    try { orders.removeIndex("idx_orders_order_number_unique"); app.save(orders); } catch (err) {}
  }
});
