/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (!settings) return;
  if (!settings.fields.getByName("maintenance_message")) {
    settings.fields.add(new TextField({ name: "maintenance_message", required: false, max: 500 }));
    app.save(settings);
  }
}, (app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (!settings) return;
  const field = settings.fields.getByName("maintenance_message");
  if (field) {
    settings.fields.remove(field.id);
    app.save(settings);
  }
});
