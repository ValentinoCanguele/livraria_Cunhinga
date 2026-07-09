/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");

  if (!users.fields.getByName("role")) {
    users.fields.add(new SelectField({
      name: "role",
      required: false,
      maxSelect: 1,
      values: ["member", "admin"],
    }));
  }

  app.save(users);

  const collection = new Collection({
    name: "stock_books",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    fields: [
      { name: "title", type: "text", required: true },
      { name: "author", type: "text", required: false },
      { name: "genre", type: "text", required: false },
      { name: "price", type: "number", required: false },
      { name: "stock", type: "number", required: false },
      { name: "cover", type: "url", required: false },
      { name: "description", type: "editor", required: false },
    ],
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("stock_books");
  if (collection) app.delete(collection);
});
