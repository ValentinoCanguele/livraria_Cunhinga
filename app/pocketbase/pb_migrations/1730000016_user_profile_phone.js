/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (!users) return;
  if (!users.fields.getByName("phone")) {
    users.fields.add(new TextField({ name: "phone", required: false, max: 24 }));
    app.save(users);
  }
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_");
  if (!users) return;
  const field = users.fields.getByName("phone");
  if (field) {
    users.fields.remove(field.id);
    app.save(users);
  }
});
