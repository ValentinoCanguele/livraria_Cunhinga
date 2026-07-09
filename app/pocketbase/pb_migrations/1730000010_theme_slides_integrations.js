/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const slides = app.findCollectionByNameOrId("hero_slides");
  if (slides) {
    const slideFields = [
      { name: "placement", type: "text" },
      { name: "is_primary", type: "bool" },
      { name: "transition", type: "text" },
      { name: "media_type", type: "text" },
      { name: "video_url", type: "text" },
      { name: "duration_ms", type: "number" },
    ];
    for (const f of slideFields) {
      if (slides.fields.getByName(f.name)) continue;
      if (f.type === "text") slides.fields.add(new TextField({ name: f.name, required: false }));
      if (f.type === "bool") slides.fields.add(new BoolField({ name: f.name, required: false }));
      if (f.type === "number") slides.fields.add(new NumberField({ name: f.name, required: false }));
    }
    app.save(slides);
  }

  const settings = app.findCollectionByNameOrId("site_settings");
  if (settings) {
    const settingFields = [
      { name: "ui_glass_enabled", type: "bool" },
      { name: "ui_glass_opacity", type: "number" },
      { name: "shop_bg_mode", type: "text" },
      { name: "shop_bg_image_url", type: "text" },
      { name: "shop_bg_video_url", type: "text" },
      { name: "shop_bg_overlay", type: "number" },
      { name: "google_maps_embed_key", type: "text" },
    ];
    for (const f of settingFields) {
      if (settings.fields.getByName(f.name)) continue;
      if (f.type === "text") settings.fields.add(new TextField({ name: f.name, required: false }));
      if (f.type === "bool") settings.fields.add(new BoolField({ name: f.name, required: false }));
      if (f.type === "number") settings.fields.add(new NumberField({ name: f.name, required: false }));
    }
    app.save(settings);
  }
}, (app) => {});
