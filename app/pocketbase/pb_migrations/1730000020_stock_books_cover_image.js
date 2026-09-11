/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const books = app.findCollectionByNameOrId("stock_books");
  if (!books) return;

  if (!books.fields.getByName("cover_image")) {
    books.fields.add(new FileField({
      name: "cover_image",
      required: false,
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    }));
    app.save(books);
  }
}, (app) => {
  const books = app.findCollectionByNameOrId("stock_books");
  if (!books) return;
  const field = books.fields.getByName("cover_image");
  if (field) {
    books.fields.removeById(field.id);
    app.save(books);
  }
});
