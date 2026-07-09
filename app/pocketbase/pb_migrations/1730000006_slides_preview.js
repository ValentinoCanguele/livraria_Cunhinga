/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const slides = app.findCollectionByNameOrId("hero_slides");
  if (slides) {
    const slideFields = [
      { name: "template", type: "text" },
      { name: "book_id", type: "text" },
      { name: "body_html", type: "editor" },
      { name: "promo_badge", type: "text" },
      { name: "promo_price", type: "number" },
      { name: "book_cover", type: "url" },
      { name: "book_title", type: "text" },
      { name: "book_author", type: "text" },
    ];
    for (const f of slideFields) {
      if (!slides.fields.getByName(f.name)) {
        if (f.type === "text") slides.fields.add(new TextField({ name: f.name, required: false }));
        if (f.type === "editor") slides.fields.add(new EditorField({ name: f.name, required: false }));
        if (f.type === "number") slides.fields.add(new NumberField({ name: f.name, required: false }));
        if (f.type === "url") slides.fields.add(new URLField({ name: f.name, required: false }));
      }
    }
    app.save(slides);
  }

  const books = app.findCollectionByNameOrId("stock_books");
  if (books) {
    const bookFields = [
      { name: "author_bio", type: "editor" },
      { name: "author_photo", type: "url" },
      { name: "sample_pages", type: "json" },
      { name: "versions", type: "json" },
      { name: "preview_enabled", type: "bool" },
    ];
    for (const f of bookFields) {
      if (!books.fields.getByName(f.name)) {
        if (f.type === "editor") books.fields.add(new EditorField({ name: f.name, required: false }));
        if (f.type === "url") books.fields.add(new URLField({ name: f.name, required: false }));
        if (f.type === "json") books.fields.add(new JSONField({ name: f.name, required: false }));
        if (f.type === "bool") books.fields.add(new BoolField({ name: f.name, required: false }));
      }
    }
    app.save(books);
  }
}, (app) => {});
