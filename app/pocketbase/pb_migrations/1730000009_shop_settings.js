/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settings = app.findCollectionByNameOrId("site_settings");
  if (!settings) return;

  const fields = [
    { name: "shop_hero_title", type: "text" },
    { name: "shop_hero_subtitle", type: "text" },
    { name: "shop_hero_badge", type: "text" },
    { name: "shop_default_sort", type: "text" },
    { name: "shop_per_page", type: "number" },
    { name: "shop_show_featured", type: "bool" },
    { name: "shop_show_collections", type: "bool" },
    { name: "shop_show_low_stock", type: "bool" },
    { name: "shop_grid_columns", type: "number" },
  ];

  for (const f of fields) {
    if (settings.fields.getByName(f.name)) continue;
    if (f.type === "text") settings.fields.add(new TextField({ name: f.name, required: false }));
    if (f.type === "number") settings.fields.add(new NumberField({ name: f.name, required: false }));
    if (f.type === "bool") settings.fields.add(new BoolField({ name: f.name, required: false }));
  }
  app.save(settings);
}, (app) => {});
