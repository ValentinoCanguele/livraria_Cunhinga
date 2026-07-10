/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const staffRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'";
  const staffOrOwner = staffRule + " || owner = @request.auth.id";
  const users = app.findCollectionByNameOrId("_pb_users_auth_");

  const contacts = new Collection({
    name: "contacts",
    type: "base",
    listRule: staffOrOwner,
    viewRule: staffOrOwner,
    createRule: staffOrOwner,
    updateRule: staffOrOwner,
    deleteRule: staffRule,
    fields: [
      { name: "name", type: "text", required: true },
      { name: "email", type: "email", required: false },
      { name: "phone", type: "text", required: false },
      { name: "photo_url", type: "url", required: false },
      { name: "source", type: "select", required: false, maxSelect: 1, values: ["manual", "google", "order", "newsletter"] },
      { name: "external_id", type: "text", required: false },
      { name: "tags", type: "json", required: false },
      { name: "notes", type: "text", required: false },
      { name: "is_buyer", type: "bool", required: false },
      { name: "last_contacted_at", type: "date", required: false },
      { name: "last_synced_at", type: "date", required: false },
      { name: "sync_status", type: "select", required: false, maxSelect: 1, values: ["synced", "pending", "conflict"] },
      { name: "metadata", type: "json", required: false },
    ],
  });
  if (users) {
    contacts.fields.add(new RelationField({
      name: "owner",
      required: false,
      collectionId: users.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
  }
  app.save(contacts);

  const contactGroups = new Collection({
    name: "contact_groups",
    type: "base",
    listRule: staffOrOwner,
    viewRule: staffOrOwner,
    createRule: staffOrOwner,
    updateRule: staffOrOwner,
    deleteRule: staffRule,
    fields: [
      { name: "name", type: "text", required: true },
      { name: "description", type: "text", required: false },
      { name: "member_ids", type: "json", required: false },
      { name: "channels", type: "json", required: false },
      { name: "is_active", type: "bool", required: false },
      { name: "color", type: "text", required: false },
    ],
  });
  if (users) {
    contactGroups.fields.add(new RelationField({
      name: "owner",
      required: false,
      collectionId: users.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
  }
  app.save(contactGroups);

  const contactCampaigns = new Collection({
    name: "contact_campaigns",
    type: "base",
    listRule: staffOrOwner,
    viewRule: staffOrOwner,
    createRule: staffOrOwner,
    updateRule: staffOrOwner,
    deleteRule: staffRule,
    fields: [
      { name: "name", type: "text", required: true },
      { name: "message_template", type: "text", required: false },
      { name: "subject", type: "text", required: false },
      { name: "channel", type: "select", required: false, maxSelect: 1, values: ["email", "whatsapp", "both"] },
      { name: "frequency", type: "select", required: false, maxSelect: 1, values: ["daily", "weekly", "biweekly", "monthly"] },
      { name: "include_new_books", type: "bool", required: false },
      { name: "last_sent_at", type: "date", required: false },
      { name: "next_send_at", type: "date", required: false },
      { name: "is_active", type: "bool", required: false },
    ],
  });
  if (users) {
    contactCampaigns.fields.add(new RelationField({
      name: "owner",
      required: false,
      collectionId: users.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
    contactCampaigns.fields.add(new RelationField({
      name: "group",
      required: false,
      collectionId: contactGroups.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
  }
  app.save(contactCampaigns);

  const contactNotifications = new Collection({
    name: "contact_notifications",
    type: "base",
    listRule: staffOrOwner,
    viewRule: staffOrOwner,
    createRule: staffOrOwner,
    updateRule: staffRule,
    deleteRule: staffRule,
    fields: [
      { name: "channel", type: "select", required: false, maxSelect: 1, values: ["email", "whatsapp", "in_app"] },
      { name: "subject", type: "text", required: false },
      { name: "body", type: "text", required: false },
      { name: "status", type: "select", required: false, maxSelect: 1, values: ["pending", "sent", "failed", "opened"] },
      { name: "sent_at", type: "date", required: false },
      { name: "whatsapp_url", type: "url", required: false },
    ],
  });
  if (users) {
    contactNotifications.fields.add(new RelationField({
      name: "owner",
      required: false,
      collectionId: users.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
    contactNotifications.fields.add(new RelationField({
      name: "contact",
      required: false,
      collectionId: contacts.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
    contactNotifications.fields.add(new RelationField({
      name: "group",
      required: false,
      collectionId: contactGroups.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
    contactNotifications.fields.add(new RelationField({
      name: "campaign",
      required: false,
      collectionId: contactCampaigns.id,
      cascadeDelete: false,
      maxSelect: 1,
    }));
  }
  app.save(contactNotifications);
}, (app) => {
  for (const name of ["contact_notifications", "contact_campaigns", "contact_groups", "contacts"]) {
    const col = app.findCollectionByNameOrId(name);
    if (col) app.delete(col);
  }
});
