/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const publicRead = "";
  const staffWrite = "@request.auth.role = 'admin' || @request.auth.role = 'manager'";

  let provinces = null;
  try {
    provinces = app.findCollectionByNameOrId("angola_provinces");
  } catch (err) {}

  if (!provinces) {
    provinces = new Collection({
      name: "angola_provinces",
      type: "base",
      listRule: publicRead,
      viewRule: publicRead,
      createRule: staffWrite,
      updateRule: staffWrite,
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "slug", type: "text", required: true },
        { name: "capital", type: "text", required: false },
        { name: "sort_order", type: "number", required: false },
        { name: "census_version", type: "text", required: false },
      ],
    });
    app.save(provinces);
  }

  let municipalities = null;
  try {
    municipalities = app.findCollectionByNameOrId("angola_municipalities");
  } catch (err) {}

  if (!municipalities) {
    municipalities = new Collection({
      name: "angola_municipalities",
      type: "base",
      listRule: publicRead,
      viewRule: publicRead,
      createRule: staffWrite,
      updateRule: staffWrite,
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "slug", type: "text", required: false },
        { name: "sort_order", type: "number", required: false },
      ],
    });
    municipalities.fields.add(new RelationField({
      name: "province",
      required: true,
      collectionId: provinces.id,
      cascadeDelete: true,
      maxSelect: 1,
    }));
    app.save(municipalities);
  }

  let localities = null;
  try {
    localities = app.findCollectionByNameOrId("angola_localities");
  } catch (err) {}

  if (!localities) {
    localities = new Collection({
      name: "angola_localities",
      type: "base",
      listRule: publicRead,
      viewRule: publicRead,
      createRule: staffWrite,
      updateRule: staffWrite,
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "type", type: "select", required: false, maxSelect: 1, values: ["comuna", "bairro", "localidade"] },
        { name: "sort_order", type: "number", required: false },
      ],
    });
    localities.fields.add(new RelationField({
      name: "municipality",
      required: true,
      collectionId: municipalities.id,
      cascadeDelete: true,
      maxSelect: 1,
    }));
    app.save(localities);
  }

  const orders = app.findCollectionByNameOrId("orders");
  if (orders) {
    const orderFields = [
      { name: "delivery_province_id", type: "text" },
      { name: "delivery_province", type: "text" },
      { name: "delivery_municipality_id", type: "text" },
      { name: "delivery_municipality", type: "text" },
      { name: "delivery_locality_id", type: "text" },
      { name: "delivery_locality", type: "text" },
      { name: "delivery_street", type: "text" },
      { name: "delivery_reference", type: "text" },
      { name: "delivery_address_full", type: "text" },
      { name: "delivery_recipient_name", type: "text" },
      { name: "delivery_recipient_id", type: "text" },
      { name: "delivery_confirmed_at", type: "date" },
      { name: "delivery_confirmed_by", type: "text" },
      { name: "delivery_signature_data", type: "text" },
      { name: "delivery_gps_lat", type: "number" },
      { name: "delivery_gps_lng", type: "number" },
    ];
    for (const f of orderFields) {
      if (!orders.fields.getByName(f.name)) {
        if (f.type === "text") orders.fields.add(new TextField({ name: f.name, required: false }));
        if (f.type === "number") orders.fields.add(new NumberField({ name: f.name, required: false }));
        if (f.type === "date") orders.fields.add(new DateField({ name: f.name, required: false }));
      }
    }
    app.save(orders);
  }
}, (app) => {
  for (const name of ["angola_localities", "angola_municipalities", "angola_provinces"]) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) app.delete(col);
    } catch (err) {}
  }
});
